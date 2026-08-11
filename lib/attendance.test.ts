import test from "node:test";
import assert from "node:assert/strict";
import { attendanceDaysByMember, daysInMonth, localDateKey } from "./attendance.ts";

test("two check-ins on one day count as one visit", () => {
  const days = attendanceDaysByMember([
    { memberId: "a", checkedInAt: "2026-08-03T06:15:00+05:30" },
    { memberId: "a", checkedInAt: "2026-08-03T19:40:00+05:30" },
    { memberId: "a", checkedInAt: "2026-08-04T06:10:00+05:30" },
  ]);
  assert.equal(daysInMonth(days.get("a"), "2026-08"), 2);
});

test("months are counted separately and an unknown member is zero", () => {
  const days = attendanceDaysByMember([
    { memberId: "a", checkedInAt: "2026-08-03T06:15:00+05:30" },
    { memberId: "a", checkedInAt: "2026-07-28T06:15:00+05:30" },
  ]);
  assert.equal(daysInMonth(days.get("a"), "2026-08"), 1);
  assert.equal(daysInMonth(days.get("a"), "2026-07"), 1);
  assert.equal(daysInMonth(days.get("nobody"), "2026-08"), 0);
});

test("the day is local, not UTC", () => {
  // 00:30 UTC is 6am in India — an early session, filed under the right date.
  const local = localDateKey("2026-08-03T00:30:00+05:30");
  assert.equal(local, `2026-08-0${new Date("2026-08-03T00:30:00+05:30").getDate()}`);
  // And a timestamp already in local time keeps its own date.
  assert.equal(localDateKey(new Date(2026, 7, 3, 6, 0).toISOString()), "2026-08-03");
});
