import { differenceInCalendarDays } from "date-fns";
// Explicit .ts extension: node --test resolves ESM strictly, and this module
// is imported by both the app and the test runner. See tsconfig's
// allowImportingTsExtensions.
import { monthKey, currentMonthKey } from "./money.ts";

/**
 * What is owed, derived — never stored.
 *
 * The schema has no plan price, so **a member's expected renewal is what they
 * last paid**. That is a proxy and it is the honest best available: if someone
 * was charged 1600 last term, 1600 is what falls due next. A member who has
 * never paid is not a debtor, they are an unapproved signup, and is excluded.
 *
 * This mirrors the accounts-receivable split every billing product uses
 * (Gymdesk: scheduled / received / overdue): money already in, money falling
 * due inside this month, and money past its date. The three never overlap, so
 * they can be added without double counting one member.
 */

export type DueReason = "overdue" | "due_this_month" | "not_taken";

export interface DueRow {
  memberId: string;
  /** What they last paid — the only price signal the schema carries. */
  expected: number;
  dueOn: string;
  /** Positive once the date has passed. */
  daysOverdue: number;
  reason: DueReason;
}

export interface DuesSummary {
  /** Latest payment was never collected — they owe that term, not a renewal. */
  notTaken: DueRow[];
  overdue: DueRow[];
  dueThisMonth: DueRow[];
  notTakenTotal: number;
  overdueTotal: number;
  dueThisMonthTotal: number;
  /** Every rupee outstanding. The three buckets are disjoint by construction. */
  stillToCollect: number;
}

/** The member fields dues actually depend on — keeps this testable in isolation. */
export interface DueCandidate {
  id: string;
  amount: number | null;
  validUntil: string | null;
  status: string;
  /** `collected` on their most recent payment. Null when they have none. */
  latestPaymentCollected: boolean | null;
}

/** 1-30 / 31-60 / 60+ — the standard aging buckets, used for sort and label. */
export function agingLabel(daysOverdue: number): string {
  if (daysOverdue <= 0) return "Due";
  if (daysOverdue === 1) return "1 day overdue";
  if (daysOverdue <= 30) return `${daysOverdue} days overdue`;
  if (daysOverdue <= 60) return `Over a month overdue`;
  return "Over two months overdue";
}

export function computeDues(members: DueCandidate[], now: Date = new Date()): DuesSummary {
  const thisMonth = currentMonthKey(now);
  const notTaken: DueRow[] = [];
  const overdue: DueRow[] = [];
  const dueThisMonth: DueRow[] = [];

  for (const m of members) {
    // A signup nobody approved owes nothing yet, and a rejected row is not a
    // debtor either. Without a payment there is no price to expect.
    if (m.status === "pending" || m.status === "rejected") continue;
    if (!m.validUntil || m.amount == null) continue;

    const daysOverdue = differenceInCalendarDays(now, new Date(m.validUntil));
    const row: DueRow = {
      memberId: m.id,
      expected: m.amount,
      dueOn: m.validUntil,
      daysOverdue,
      reason: "overdue",
    };

    // Checked before the dates, and it is why the buckets stay disjoint. A
    // member whose latest payment was never collected owes *that term* — the
    // money for the time they already used. Counting them as an overdue
    // renewal as well would bill the same rupees twice, which is exactly what
    // the first version of this did.
    if (m.latestPaymentCollected === false) {
      notTaken.push({ ...row, reason: "not_taken" });
    } else if (daysOverdue > 0) {
      overdue.push(row);
    } else if (monthKey(m.validUntil) === thisMonth) {
      // Falls due inside this calendar month and has not passed yet. A term
      // ending next month is not this month's problem.
      dueThisMonth.push({ ...row, reason: "due_this_month" });
    }
  }

  // Longest overdue first — that is the order he should work the list in.
  notTaken.sort((a, b) => b.daysOverdue - a.daysOverdue);
  overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
  // Soonest first, so the next one to lapse is at the top.
  dueThisMonth.sort((a, b) => a.dueOn.localeCompare(b.dueOn));

  const sum = (rows: DueRow[]) => rows.reduce((s, r) => s + r.expected, 0);
  const notTakenTotal = sum(notTaken);
  const overdueTotal = sum(overdue);
  const dueThisMonthTotal = sum(dueThisMonth);

  return {
    notTaken,
    overdue,
    dueThisMonth,
    notTakenTotal,
    overdueTotal,
    dueThisMonthTotal,
    stillToCollect: notTakenTotal + overdueTotal + dueThisMonthTotal,
  };
}
