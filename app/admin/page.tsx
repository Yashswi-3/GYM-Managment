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
      supabase.from("members").select("id, name, mobile, email, join_date, plan_name, is_active_override"),
      supabase
        .from("payments")
        .select("id, member_id, amount, paid_on, valid_until")
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
    { id: string; amount: number; paid_on: string; valid_until: string }
  >();
  const paymentCountByMember = new Map<string, number>();
  const paidThisMonthMembers = new Set<string>();
  for (const p of payments ?? []) {
    if (!latestPaymentByMember.has(p.member_id)) {
      latestPaymentByMember.set(p.member_id, p);
    }
    paymentCountByMember.set(p.member_id, (paymentCountByMember.get(p.member_id) ?? 0) + 1);
    const paidOn = new Date(p.paid_on);
    if (`${paidOn.getFullYear()}-${paidOn.getMonth()}` === currentMonthKey) {
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
    const hasAnyPayment = (paymentCountByMember.get(m.id) ?? 0) > 0;
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
      // Self-signed-up members with zero payments are "pending", not "expired".
      status: hasAnyPayment
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

  const pendingMembers: PendingMember[] = (members ?? [])
    .filter((m) => (paymentCountByMember.get(m.id) ?? 0) === 0)
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

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>
      <AdminTabs
        totalMembers={totalMembers}
        paidCount={paidCount}
        unpaidCount={unpaidCount}
        visitorCount={visitorList.length}
        convertedCount={convertedCount}
        activity={activity}
        pendingMembers={pendingMembers}
        memberRows={memberRows}
        visitorRows={visitorRows}
      />
    </div>
  );
}
