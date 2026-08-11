/**
 * How often a member actually turns up.
 *
 * Counted in **distinct days**, not check-in rows: someone who scans twice in
 * one visit has attended once. `checked_in_at` is a timestamptz, so the day is
 * taken in local time — a 6am check-in in India is 00:30 UTC the same date, and
 * a UTC slice would file half the early sessions under yesterday.
 */

/** A timestamptz -> "YYYY-MM-DD" in the owner's timezone. */
export function localDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** memberId -> the set of days they came in. */
export function attendanceDaysByMember(
  rows: { memberId: string; checkedInAt: string }[]
): Map<string, Set<string>> {
  const byMember = new Map<string, Set<string>>();
  for (const r of rows) {
    let days = byMember.get(r.memberId);
    if (!days) {
      days = new Set();
      byMember.set(r.memberId, days);
    }
    days.add(localDateKey(r.checkedInAt));
  }
  return byMember;
}

/** Days attended inside one month key ("2026-08"). */
export function daysInMonth(days: Set<string> | undefined, month: string): number {
  if (!days) return 0;
  let count = 0;
  for (const d of days) if (d.startsWith(month)) count++;
  return count;
}
