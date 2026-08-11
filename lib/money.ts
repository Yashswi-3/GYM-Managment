/**
 * Money and month helpers for the Fees dashboard.
 *
 * `paid_on` is a date-only column, so months are derived by slicing the ISO
 * string rather than via `new Date(...).getMonth()`. Parsing "2026-08-01"
 * gives UTC midnight, which lands on 31 July for anyone west of Greenwich —
 * the string never lies about which month it names.
 */

const inrFormat = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function inr(amount: number): string {
  return inrFormat.format(amount);
}

/** "2026-08-11" -> "2026-08" */
export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** Local current month as "2026-08" — not UTC, the owner's calendar is local. */
export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-08" -> "Aug 2026" */
export function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

/** "2026-08" shifted by whole months: -1 -> "2026-07", +1 -> "2026-09". */
export function shiftMonth(key: string, delta: number): string {
  const [year, month] = key.split("-").map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** The N most recent months ending at `now`, oldest first. */
export function recentMonthKeys(count: number, now: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}
