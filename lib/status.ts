import { differenceInCalendarDays } from "date-fns";

export type MemberStatus = "pending" | "active" | "expiring_soon" | "expired" | "inactive";

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
