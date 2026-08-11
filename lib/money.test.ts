import test from "node:test";
import assert from "node:assert/strict";
import { monthKey, currentMonthKey, recentMonthKeys, inr } from "./money.ts";

test("monthKey reads the string, not a parsed Date", () => {
  // The whole reason monthKey slices: new Date("2026-08-01") is UTC midnight,
  // which is 31 July for anyone west of Greenwich. The string cannot drift.
  assert.equal(monthKey("2026-08-01"), "2026-08");
  assert.equal(monthKey("2026-12-31"), "2026-12");
});

test("currentMonthKey pads the month so keys sort and compare", () => {
  assert.equal(currentMonthKey(new Date(2026, 0, 15)), "2026-01");
  assert.equal(currentMonthKey(new Date(2026, 8, 1)), "2026-09");
  // Must match monthKey's format or every lookup silently misses.
  assert.equal(currentMonthKey(new Date(2026, 7, 11)), monthKey("2026-08-11"));
});

test("recentMonthKeys walks backwards across a year boundary", () => {
  assert.deepEqual(recentMonthKeys(6, new Date(2026, 0, 15)), [
    "2025-08",
    "2025-09",
    "2025-10",
    "2025-11",
    "2025-12",
    "2026-01",
  ]);
  // Oldest first, current month last — the bar chart reads left to right.
  const six = recentMonthKeys(6, new Date(2026, 7, 11));
  assert.equal(six.at(-1), "2026-08");
  assert.equal(six.length, 6);
});

test("inr renders whole rupees", () => {
  const out = inr(4600);
  assert.ok(out.includes("4,600"), out);
  assert.ok(!out.includes("."), out);
});

// Run: npm test
