import test from "node:test";
import assert from "node:assert/strict";
import { computeDues, agingLabel, type DueCandidate } from "./dues.ts";

const now = new Date(2026, 7, 11); // 11 Aug 2026

function m(over: Partial<DueCandidate> & { id: string }): DueCandidate {
  return { amount: 1500, validUntil: "2026-08-20", status: "active", latestPaymentCollected: true, ...over };
}

test("the three buckets never contain the same member twice", () => {
  const d = computeDues(
    [
      m({ id: "past", validUntil: "2026-07-01" }),
      m({ id: "soon", validUntil: "2026-08-20" }),
      m({ id: "later", validUntil: "2026-09-20" }),
    ],
    now
  );
  assert.deepEqual(d.overdue.map((r) => r.memberId), ["past"]);
  assert.deepEqual(d.dueThisMonth.map((r) => r.memberId), ["soon"]);
  // Next month is not this month's problem.
  assert.equal(d.stillToCollect, 3000);
});

test("a signup nobody approved is not a debtor", () => {
  const d = computeDues(
    [
      m({ id: "pending", status: "pending", validUntil: "2026-07-01" }),
      m({ id: "rejected", status: "rejected", validUntil: "2026-07-01" }),
      m({ id: "never-paid", amount: null, validUntil: null }),
    ],
    now
  );
  assert.equal(d.overdue.length, 0);
  assert.equal(d.dueThisMonth.length, 0);
  assert.equal(d.stillToCollect, 0);
});

test("overdue is worked longest-first, due is worked soonest-first", () => {
  const d = computeDues(
    [
      m({ id: "a", validUntil: "2026-08-01" }), // 10 days over
      m({ id: "b", validUntil: "2026-05-01" }), // 102 days over
      m({ id: "c", validUntil: "2026-08-31" }),
      m({ id: "d", validUntil: "2026-08-12" }),
    ],
    now
  );
  assert.deepEqual(d.overdue.map((r) => r.memberId), ["b", "a"]);
  assert.deepEqual(d.dueThisMonth.map((r) => r.memberId), ["d", "c"]);
});

test("expected amount is what they last paid, per member", () => {
  const d = computeDues(
    [m({ id: "a", amount: 1600, validUntil: "2026-07-01" }), m({ id: "b", amount: 1200, validUntil: "2026-07-01" })],
    now
  );
  assert.equal(d.overdueTotal, 2800);
});

test("a term ending today is due, not overdue", () => {
  const d = computeDues([m({ id: "today", validUntil: "2026-08-11" })], now);
  assert.equal(d.overdue.length, 0);
  assert.equal(d.dueThisMonth.length, 1);
});

test("an uncollected payment is owed ONCE, not as a renewal too", () => {
  // Regression: this member is past their end date AND their last payment was
  // never taken. Counting both would bill the same rupees twice.
  const d = computeDues(
    [m({ id: "x", amount: 1600, validUntil: "2026-08-03", latestPaymentCollected: false })],
    now
  );
  assert.equal(d.overdue.length, 0);
  assert.equal(d.notTaken.length, 1);
  assert.equal(d.stillToCollect, 1600);
});

test("every member lands in exactly one bucket", () => {
  const people = [
    m({ id: "a", validUntil: "2026-05-01" }),
    m({ id: "b", validUntil: "2026-08-20" }),
    m({ id: "c", validUntil: "2026-08-03", latestPaymentCollected: false }),
    m({ id: "d", validUntil: "2026-09-20" }),
    m({ id: "e", status: "pending", validUntil: "2026-05-01" }),
  ];
  const d = computeDues(people, now);
  const ids = [...d.notTaken, ...d.overdue, ...d.dueThisMonth].map((r) => r.memberId);
  assert.equal(new Set(ids).size, ids.length, "a member appears twice");
  assert.equal(d.stillToCollect, d.notTakenTotal + d.overdueTotal + d.dueThisMonthTotal);
});

test("agingLabel buckets", () => {
  assert.equal(agingLabel(0), "Due");
  assert.equal(agingLabel(1), "1 day overdue");
  assert.equal(agingLabel(14), "14 days overdue");
  assert.equal(agingLabel(45), "Over a month overdue");
  assert.equal(agingLabel(90), "Over two months overdue");
});
