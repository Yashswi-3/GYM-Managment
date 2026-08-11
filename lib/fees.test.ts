import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMonthBook,
  arrears,
  expectedAmount,
  agingLabel,
  outstandingNow,
  type FeeMember,
  type FeePayment,
} from "./fees.ts";

const now = new Date(2026, 7, 11); // 11 Aug 2026
const AUG = "2026-08";

function m(over: Partial<FeeMember> & { id: string }): FeeMember {
  return {
    status: "active",
    planPrice: 1500,
    lastPaidAmount: 1500,
    validUntil: "2026-08-20",
    ...over,
  };
}

function pay(over: Partial<FeePayment> & { memberId: string }): FeePayment {
  return { amount: 1500, paidOn: "2026-08-05", collected: true, ...over };
}

test("expected = collected + not taken + still to collect", () => {
  const members = [
    m({ id: "took" }),
    m({ id: "wrote-it-down" }),
    m({ id: "owes" }),
    m({ id: "next-month", validUntil: "2026-09-20" }),
  ];
  const payments = [
    pay({ memberId: "took" }),
    pay({ memberId: "wrote-it-down", collected: false }),
  ];

  const book = buildMonthBook(members, payments, AUG, now);

  assert.equal(book.collected, 1500);
  assert.equal(book.notTaken, 1500);
  assert.equal(book.stillToCollect, 1500);
  assert.equal(book.expected, 4500);
  // A term ending in September is not August's money.
  assert.equal(book.unpaid.some((r) => r.memberId === "next-month"), false);
});

/**
 * The reason this module was rewritten. The old version derived what was due
 * from live `valid_until`, so taking a payment moved the member out of the
 * bucket and the month's target dropped — a number that shrinks as you work it
 * cannot tell you how much the month was ever worth.
 */
test("recording a payment moves a member without changing what the month expected", () => {
  const members = [m({ id: "a" }), m({ id: "b" })];
  const before = buildMonthBook(members, [], AUG, now);
  assert.equal(before.expected, 3000);
  assert.equal(before.paidCount, 0);
  assert.equal(before.unpaidCount, 2);

  // "a" pays: their term rolls forward, and a payment row lands in August.
  const after = buildMonthBook(
    [m({ id: "a", validUntil: "2026-09-20" }), m({ id: "b" })],
    [pay({ memberId: "a" })],
    AUG,
    now
  );

  assert.equal(after.expected, 3000, "the month's target must not move");
  assert.equal(after.collected, 1500);
  assert.equal(after.stillToCollect, 1500);
  assert.equal(after.paidCount, 1);
  assert.equal(after.unpaidCount, 1);
});

test("a member is counted once even with a taken and an untaken payment in the month", () => {
  const book = buildMonthBook(
    [m({ id: "both" })],
    [
      pay({ memberId: "both", amount: 1000 }),
      pay({ memberId: "both", amount: 500, collected: false }),
    ],
    AUG,
    now
  );

  assert.equal(book.paidCount, 1);
  assert.equal(book.unpaidCount, 0);
  // Both sums still stand — the 500 was written down and never arrived.
  assert.equal(book.collected, 1000);
  assert.equal(book.notTaken, 500);
  assert.equal(book.expected, 1500);
});

test("a signup nobody approved is not a debtor", () => {
  const book = buildMonthBook(
    [
      m({ id: "pending", status: "pending" }),
      m({ id: "rejected", status: "rejected" }),
      m({ id: "real" }),
    ],
    [],
    AUG,
    now
  );
  assert.equal(book.expected, 1500);
  assert.deepEqual(book.unpaid.map((r) => r.memberId), ["real"]);
});

test("arrears stay out of the month so a past month's total cannot move", () => {
  const members = [
    m({ id: "june", validUntil: "2026-06-10" }),
    m({ id: "august" }),
  ];
  const book = buildMonthBook(members, [], AUG, now);
  const late = arrears(members, AUG, now);

  assert.equal(book.expected, 1500, "August owes August's money only");
  assert.deepEqual(late.rows.map((r) => r.memberId), ["june"]);
  assert.equal(late.total, 1500);
  // Nobody is in both.
  const inBoth = late.rows.filter((r) => book.unpaid.some((u) => u.memberId === r.memberId));
  assert.deepEqual(inBoth, []);
});

test("outstanding now is this month's shortfall plus everything older", () => {
  const members = [
    m({ id: "june", validUntil: "2026-06-10" }),
    m({ id: "august" }),
    m({ id: "paid-up", validUntil: "2026-09-20" }),
  ];
  assert.equal(outstandingNow(members, [], now), 3000);
});

test("the stored price wins, last paid is the fallback, neither means excluded", () => {
  assert.equal(expectedAmount(m({ id: "x", planPrice: 2000, lastPaidAmount: 1500 })), 2000);
  assert.equal(expectedAmount(m({ id: "x", planPrice: null, lastPaidAmount: 1500 })), 1500);
  assert.equal(expectedAmount(m({ id: "x", planPrice: null, lastPaidAmount: null })), null);

  // A member with no price signal at all is left out rather than counted as 0.
  const book = buildMonthBook(
    [m({ id: "unknown", planPrice: null, lastPaidAmount: null })],
    [],
    AUG,
    now
  );
  assert.equal(book.expected, 0);
  assert.equal(book.unpaidCount, 0);
});

test("the worklist puts untaken payments above plain unpaid, then oldest first", () => {
  const book = buildMonthBook(
    [
      m({ id: "mild", validUntil: "2026-08-20" }),
      m({ id: "old", validUntil: "2026-08-01" }),
      m({ id: "bounced", validUntil: "2026-08-25" }),
    ],
    [pay({ memberId: "bounced", collected: false })],
    AUG,
    now
  );
  assert.deepEqual(book.unpaid.map((r) => r.memberId), ["bounced", "old", "mild"]);
});

test("aging labels", () => {
  assert.equal(agingLabel(0), "Due");
  assert.equal(agingLabel(1), "1 day overdue");
  assert.equal(agingLabel(12), "12 days overdue");
  assert.equal(agingLabel(45), "Over a month overdue");
  assert.equal(agingLabel(90), "Over two months overdue");
});
