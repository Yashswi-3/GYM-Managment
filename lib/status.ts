import { differenceInCalendarDays, addMonths, format, parseISO } from "date-fns";

export type MemberStatus =
  | "pending"
  | "rejected"
  | "active"
  | "expiring_soon"
  | "expired"
  | "inactive";

/**
 * FR2 — status is always derived from the latest payment's valid_until,
 * never stored as its own column. "Expiring soon" mirrors the FR10 window
 * (3 days or fewer remaining) so the dashboard and the notification job
 * agree on what "about to lapse" means.
 *
 * New: is_active_override allows admin to manually set active/inactive.
 * - null (default): derived from validUntil
 * - true: forced active
 * - false: forced inactive
 */
export function memberStatus(
  validUntil: string | null,
  today: Date = new Date(),
  isActiveOverride: boolean | null = null
): MemberStatus {
  // Admin override takes precedence
  if (isActiveOverride === true) return "active";
  if (isActiveOverride === false) return "inactive";

  // Derived status (original logic)
  if (!validUntil) return "expired";
  const daysLeft = differenceInCalendarDays(new Date(validUntil), today);
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 3) return "expiring_soon";
  return "active";
}

export function daysUntil(dateStr: string, today: Date = new Date()): number {
  return differenceInCalendarDays(new Date(dateStr), today);
}

export function daysSince(dateStr: string, today: Date = new Date()): number {
  return differenceInCalendarDays(today, new Date(dateStr));
}

/** Today, formatted for a native <input type="date">. */
export function todayISO(today: Date = new Date()): string {
  return format(today, "yyyy-MM-dd");
}

/**
 * End of a term that begins on `startISO` and runs `months` calendar months —
 * calendar months, not 30-day blocks, because a member who starts on the 22nd
 * expects to end on the 22nd. date-fns clamps a short month for us
 * (31/1 + 1 month -> 28/2).
 */
export function endOfTerm(startISO: string, months: number): string {
  return format(addMonths(parseISO(startISO), months), "yyyy-MM-dd");
}
