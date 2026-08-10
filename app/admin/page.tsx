import { createClient } from "@/lib/supabase/server";
import { memberStatus, daysSince } from "@/lib/status";
import type { MemberRow } from "./MembersTable";
import type { PendingMember } from "./PendingSignups";
import type { VisitorRow } from "./VisitorsTable";
import type { ActivityRow } from "./ActivityFeed";
import AdminTabs from "./AdminTabs";

// ASSUMPTION (flagged as an open question in 01_PRD.md): "paid this month"
// is read as calendar-month billing — a member counts as paid if they have
// a payment record with paid_on in the current calendar month. Swap this
// for anniversary billing if the owner tells us otherwise during the demo.
export default async function AdminDashboard() {
  const supabase = await createClient();

  const [{ data: members }, { data: payments }, { data: attendance }, { data: visitors }] =
    await Promise.all([
      supabase
        .from("members")
        .select(
          "id, name, mobile, email, join_date, plan_name, is_active_override, approved_at, rejected_at"
        ),
      supabase
        .from("payments")
        .select("id, member_id, amount, paid_on, valid_until, collected")
        .order("valid_until", { ascending: false }),
      supabase
        .from("attendance")
        .select("id, member_id, checked_in_at")
        .order("checked_in_at", { ascending: false }),
      supabase
        .from("visitors")
        .select("id, name, mobile, email, remarks, visited_on, converted_member_id")
        .order("visited_on", { ascending: false }),
    ]);

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;

  const latestPaymentByMember = new Map<
    string,
    { id: string; amount: number; paid_on: string; valid_until: string; collected: boolean }
  >();
  const paidThisMonthMembers = new Set<string>();
  // The single most recent payment across everyone — Phase 4 pre-fills the
  // activate form from it. ISO date strings compare correctly as strings.
  // payments has no created_at, and paid_on is date-only, so a batch entered
  // on one day ties: strict `>` keeps the first match, and the query is
  // ordered valid_until desc, so the tie breaks toward the latest expiry.
  let newestPayment: { member_id: string; amount: number; paid_on: string } | null = null;
  for (const p of payments ?? []) {
    if (!latestPaymentByMember.has(p.member_id)) {
      latestPaymentByMember.set(p.member_id, p);
    }
    if (!newestPayment || p.paid_on > newestPayment.paid_on) newestPayment = p;
    const paidOn = new Date(p.paid_on);
    // `collected` is what separates money actually taken from a row that only
    // records what's owed — a "Payment Not Done" activation writes the latter.
    if (p.collected && `${paidOn.getFullYear()}-${paidOn.getMonth()}` === currentMonthKey) {
      paidThisMonthMembers.add(p.member_id);
    }
  }

  const lastSeenByMember = new Map<string, string>();
  for (const a of attendance ?? []) {
    const existing = lastSeenByMember.get(a.member_id);
    if (!existing || new Date(a.checked_in_at) > new Date(existing)) {
      lastSeenByMember.set(a.member_id, a.checked_in_at);
    }
  }

  const memberNameById = new Map<string, string>();
  const memberRows: MemberRow[] = (members ?? []).map((m) => {
    memberNameById.set(m.id, m.name);
    const latestPayment = latestPaymentByMember.get(m.id);
    const lastSeen = lastSeenByMember.get(m.id) ?? null;
    return {
      id: m.id,
      name: m.name,
      mobile: m.mobile,
      email: m.email,
      joinDate: m.join_date,
      planName: m.plan_name ?? "—",
      paymentId: latestPayment?.id ?? null,
      amount: latestPayment?.amount ?? null,
      paidOn: latestPayment?.paid_on ?? null,
      validUntil: latestPayment?.valid_until ?? null,
      isActiveOverride: m.is_active_override ?? null,
      // Self-signed-up members the owner hasn't approved are "pending", not
      // "expired". Keyed off approved_at rather than "has zero payments" so
      // there is exactly one definition of approved in the app — see
      // supabase/migrations/0010_member_approval.sql.
      status: m.rejected_at
        ? "rejected"
        : m.approved_at
        ? memberStatus(latestPayment?.valid_until ?? null, now, m.is_active_override ?? null)
        : m.is_active_override === true
          ? "active"
          : m.is_active_override === false
            ? "inactive"
            : "pending",
      tenureDays: daysSince(m.join_date, now),
      lastSeen,
      inactive7: lastSeen ? daysSince(lastSeen, now) >= 7 : true,
      // Distinct from `status`: whether they have a payment dated within the
      // *current calendar month* specifically, which is what the "Paid this
      // month" / "Unpaid this month" stat cards count and filter by.
      paidThisMonth: paidThisMonthMembers.has(m.id),
    };
  });

  // Phase 4 — approving a signup was three typed fields on a phone. The term
  // now comes from PlanDuration (defaulting to Monthly), so the only thing
  // left to carry forward is what he last charged. Editable, obviously.
  const lastAmount = newestPayment?.amount ?? null;

  const pendingMembers: PendingMember[] = (members ?? [])
    .filter((m) => !m.approved_at && !m.rejected_at)
    .map((m) => ({
      id: m.id,
      name: m.name,
      mobile: m.mobile,
      email: m.email,
      joinDate: m.join_date,
    }));

  const visitorList = visitors ?? [];
  const visitorRows: VisitorRow[] = visitorList.map((v) => ({
    id: v.id,
    name: v.name,
    mobile: v.mobile,
    email: v.email,
    remarks: v.remarks,
    visitedOn: v.visited_on,
    converted: !!v.converted_member_id,
  }));
  const convertedCount = visitorList.filter((v) => v.converted_member_id).length;

  const activity: ActivityRow[] = (attendance ?? []).slice(0, 30).map((a) => ({
    id: a.id,
    memberName: memberNameById.get(a.member_id) ?? "Unknown member",
    checkedInAt: a.checked_in_at,
  }));

  const totalMembers = memberRows.length;
  const paidCount = memberRows.filter((member) => member.paidThisMonth).length;
  const unpaidCount = totalMembers - paidCount;
  const expiringCount = memberRows.filter((m) => m.status === "expiring_soon").length;

  return (
    <div className="container py-8">
      <AdminTabs
        totalMembers={totalMembers}
        paidCount={paidCount}
        unpaidCount={unpaidCount}
        visitorCount={visitorList.length}
        convertedCount={convertedCount}
        activity={activity}
        pendingMembers={pendingMembers}
        defaultAmount={lastAmount}
        expiringCount={expiringCount}
        memberRows={memberRows}
        visitorRows={visitorRows}
      />
    </div>
  );
}
