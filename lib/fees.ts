import { differenceInCalendarDays } from "date-fns";
// Explicit .ts extension: node --test resolves ESM strictly and this module is
// imported by both the app and the test runner. See allowImportingTsExtensions.
import { monthKey, currentMonthKey } from "./money.ts";

/**
 * The fees book, one calendar month at a time.
 *
 * **Members are billed on their own renewal date, and reported by calendar
 * month.** A term ending on 12 August is August's money. That is the only
 * reading that reconciles the two things the app used to do at once — count
 * "paid this month" off `paid_on` (calendar) while deriving what was owed off
 * `valid_until` (anniversary) — which is why the same member could be both
 * "not paid" and "not due yet" on the same screen.
 *
 * For any month M every rupee lands in exactly one of three places:
 *
 *   collected      payments dated in M with collected = true
 *   notTaken       payments dated in M with collected = false
 *   stillToCollect members whose term ends in M with no payment in M
 *
 *   expected = collected + notTaken + stillToCollect
 *
 * **That identity is the whole point.** Recording a payment moves a member from
 * stillToCollect into collected and leaves `expected` untouched, so the month's
 * target is a fixed number you can work down. The previous version derived what
 * was due from live `valid_until` only, so the headline shrank every time
 * somebody paid — a total that changes as you use it cannot be a target.
 *
 * Money owed is per member; money in is per payment. Both are summed
 * independently, so the identity holds even in the odd case where one member
 * has both a taken and an untaken payment inside the same month.
 */

export interface FeeMember {
  id: string;
  /** pending and rejected owe nothing — they are signups, not debtors. */
  status: string;
  /** `members.plan_price`. Null falls back to what they last paid. */
  planPrice: number | null;
  lastPaidAmount: number | null;
  /** End of their current term. Null means they have never had one. */
  validUntil: string | null;
}

export interface FeePayment {
  memberId: string;
  amount: number;
  paidOn: string;
  /** False records what is owed; it is not money that changed hands. */
  collected: boolean;
}

export type RowKind = "paid" | "not_taken" | "unpaid";

export interface FeeRow {
  memberId: string;
  amount: number;
  kind: RowKind;
  /** End of the term this charge is for. Null when it is a payment in advance. */
  dueOn: string | null;
  /** Positive once the due date has passed. */
  daysOverdue: number;
}

export interface MonthBook {
  month: string;
  expected: number;
  collected: number;
  notTaken: number;
  stillToCollect: number;
  /** Members who paid in this month, most recent first. */
  paid: FeeRow[];
  /** Who to chase, worst first. Untaken payments then plain unpaid. */
  unpaid: FeeRow[];
  paidCount: number;
  unpaidCount: number;
}

/**
 * What one member is charged. The stored price wins; what they last paid is
 * the fallback, because for an existing member it is the price that was in
 * force. Null means neither is known — they have never paid and nobody has set
 * a price, so they are excluded rather than counted as zero.
 */
export function expectedAmount(m: FeeMember): number | null {
  if (m.planPrice != null) return m.planPrice;
  if (m.lastPaidAmount != null) return m.lastPaidAmount;
  return null;
}

function billable(m: FeeMember): boolean {
  return m.status !== "pending" && m.status !== "rejected";
}

/** 1-30 / 31-60 / 60+ — standard aging, used for the label and the sort. */
export function agingLabel(daysOverdue: number): string {
  if (daysOverdue <= 0) return "Due";
  if (daysOverdue === 1) return "1 day overdue";
  if (daysOverdue <= 30) return `${daysOverdue} days overdue`;
  if (daysOverdue <= 60) return "Over a month overdue";
  return "Over two months overdue";
}

export function buildMonthBook(
  members: FeeMember[],
  payments: FeePayment[],
  month: string,
  now: Date = new Date()
): MonthBook {
  // Money in, summed per payment — the factual side of the book.
  let collected = 0;
  let notTaken = 0;
  const collectedByMember = new Map<string, number>();
  const notTakenByMember = new Map<string, number>();
  const latestPaidOn = new Map<string, string>();

  for (const p of payments) {
    if (monthKey(p.paidOn) !== month) continue;
    if (p.collected) {
      collected += p.amount;
      collectedByMember.set(p.memberId, (collectedByMember.get(p.memberId) ?? 0) + p.amount);
      const seen = latestPaidOn.get(p.memberId);
      if (!seen || p.paidOn > seen) latestPaidOn.set(p.memberId, p.paidOn);
    } else {
      notTaken += p.amount;
      notTakenByMember.set(p.memberId, (notTakenByMember.get(p.memberId) ?? 0) + p.amount);
    }
  }

  // Money owed, one entry per member — the side that has to stay disjoint.
  let stillToCollect = 0;
  const paid: FeeRow[] = [];
  const unpaid: FeeRow[] = [];

  for (const m of members) {
    if (!billable(m)) continue;

    const took = collectedByMember.get(m.id);
    const owedButNotTaken = notTakenByMember.get(m.id);
    const dueThisMonth = m.validUntil != null && monthKey(m.validUntil) === month;
    const daysOverdue = m.validUntil ? differenceInCalendarDays(now, new Date(m.validUntil)) : 0;

    if (took != null) {
      paid.push({
        memberId: m.id,
        amount: took,
        kind: "paid",
        dueOn: latestPaidOn.get(m.id) ?? null,
        daysOverdue: 0,
      });
      continue;
    }

    if (owedButNotTaken != null) {
      // A payment was written down but the cash never arrived. They owe the
      // term they have already used, which is a harder debt than a renewal.
      unpaid.push({
        memberId: m.id,
        amount: owedButNotTaken,
        kind: "not_taken",
        dueOn: m.validUntil,
        daysOverdue,
      });
      continue;
    }

    if (dueThisMonth) {
      const amount = expectedAmount(m);
      if (amount == null) continue;
      stillToCollect += amount;
      unpaid.push({ memberId: m.id, amount, kind: "unpaid", dueOn: m.validUntil, daysOverdue });
    }
  }

  // Worst first: an untaken payment outranks a renewal at the same age, then
  // longest overdue. That is the order to work the list in.
  const rank = (r: FeeRow) => (r.kind === "not_taken" ? 1 : 0);
  unpaid.sort((a, b) => rank(b) - rank(a) || b.daysOverdue - a.daysOverdue);
  paid.sort((a, b) => (b.dueOn ?? "").localeCompare(a.dueOn ?? ""));

  return {
    month,
    expected: collected + notTaken + stillToCollect,
    collected,
    notTaken,
    stillToCollect,
    paid,
    unpaid,
    paidCount: paid.length,
    unpaidCount: unpaid.length,
  };
}

/**
 * Terms that ended before `month` and were never renewed — last month's
 * problem, still yours.
 *
 * Deliberately outside the month book. Folding arrears into a month's total
 * would mean August's figure changed depending on when you looked at it, and a
 * month whose number moves after the fact is not a record of anything.
 */
export function arrears(
  members: FeeMember[],
  month: string,
  now: Date = new Date()
): { rows: FeeRow[]; total: number } {
  const rows: FeeRow[] = [];
  let total = 0;

  for (const m of members) {
    if (!billable(m) || !m.validUntil) continue;
    if (monthKey(m.validUntil) >= month) continue;

    const amount = expectedAmount(m);
    if (amount == null) continue;
    total += amount;
    rows.push({
      memberId: m.id,
      amount,
      kind: "unpaid",
      dueOn: m.validUntil,
      daysOverdue: differenceInCalendarDays(now, new Date(m.validUntil)),
    });
  }

  rows.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return { rows, total };
}

/** Every rupee ever taken. Untaken rows are not money. */
export function allTimeCollected(payments: FeePayment[]): number {
  return payments.reduce((sum, p) => (p.collected ? sum + p.amount : sum), 0);
}

/** This month's book plus everything still owed from before it. */
export function outstandingNow(
  members: FeeMember[],
  payments: FeePayment[],
  now: Date = new Date()
): number {
  const month = currentMonthKey(now);
  const book = buildMonthBook(members, payments, month, now);
  return book.stillToCollect + book.notTaken + arrears(members, month, now).total;
}
