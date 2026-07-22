import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyMemberAndOwner } from "@/lib/email";
import { daysUntil, daysSince } from "@/lib/status";

export const dynamic = "force-dynamic";

type TriggerType = "expiry_3" | "expiry_2" | "expiry_1" | "expiry_0" | "inactive_7";

const EXPIRY_TRIGGER_BY_DAYS: Record<number, TriggerType> = {
  3: "expiry_3",
  2: "expiry_2",
  1: "expiry_1",
  0: "expiry_0",
};

/**
 * Runs once a day (Vercel Cron or Supabase pg_cron hit this route with the
 * CRON_SECRET header). Checks every member's days-until-expiry and
 * days-since-last-checkin, and fires the FR10/FR11 emails. FR12 is enforced
 * by checking notification_log before sending anything, so a re-run of this
 * same route on the same day never double-sends.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const now = new Date();

  const { data: members } = await supabase
    .from("members")
    .select("id, name, email, payments(valid_until), attendance(checked_in_at)");

  if (!members) return NextResponse.json({ sent: 0 });

  let sentCount = 0;

  for (const member of members) {
    const validUntils = (member.payments ?? []).map((p: { valid_until: string }) => p.valid_until);
    const latestValidUntil = validUntils.sort().at(-1) ?? null;

    const checkins = (member.attendance ?? []).map((a: { checked_in_at: string }) => a.checked_in_at);
    const lastCheckin = checkins.sort().at(-1) ?? null;

    // --- FR10: expiry warnings at 3, 2, 1 day(s) remaining, plus the day
    // the membership actually lapses (0 remaining) ---
    if (latestValidUntil) {
      const remaining = daysUntil(latestValidUntil, now);
      const trigger = EXPIRY_TRIGGER_BY_DAYS[remaining];
      if (trigger) {
        const sent = await sendIfNotAlreadySent(supabase, member.id, trigger, () => {
          const subject =
            remaining === 0
              ? "Your membership has ended today"
              : `Your membership expires in ${remaining} day${remaining === 1 ? "" : "s"}`;
          const body =
            remaining === 0
              ? `Hi ${member.name}, your gym membership ended today and hasn't been renewed. Renew now to keep your access active.`
              : `Hi ${member.name}, your gym membership expires in ${remaining} day${remaining === 1 ? "" : "s"}. Renew soon to avoid a lapse.`;
          return notifyMemberAndOwner(member.email, member.name, subject, body);
        });
        if (sent) sentCount++;
      }
    }

    // --- FR11: inactivity warning at exactly 7 days since last check-in ---
    if (lastCheckin && daysSince(lastCheckin, now) === 7) {
      const sent = await sendIfNotAlreadySent(supabase, member.id, "inactive_7", () => {
        const subject = "We haven't seen you in a week";
        const body = `Hi ${member.name}, it's been 7 days since your last check-in. Hope to see you back at the gym soon!`;
        return notifyMemberAndOwner(member.email, member.name, subject, body);
      });
      if (sent) sentCount++;
    }
  }

  return NextResponse.json({ sent: sentCount });
}

async function sendIfNotAlreadySent(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  memberId: string,
  trigger: TriggerType,
  send: () => Promise<void>
): Promise<boolean> {
  // FR12 — notification_log's unique (member_id, trigger_type, sent_on) index
  // is the actual guard; inserting first and only sending on success also
  // protects against two overlapping job runs racing each other.
  const { error: logError } = await supabase
    .from("notification_log")
    .insert({ member_id: memberId, trigger_type: trigger });

  if (logError) {
    // Unique violation means it already went out today — skip silently.
    return false;
  }

  await send();
  return true;
}
