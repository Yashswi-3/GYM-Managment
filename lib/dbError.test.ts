import test from "node:test";
import assert from "node:assert/strict";
import { publicDbError } from "./dbError.ts";

// The whole point of publicDbError is that Postgres' own wording never
// reaches a member's screen. If someone "helpfully" makes the message more
// specific later, this fails.
test("never returns the database's own message", () => {
  const raw = 'duplicate key value violates unique constraint "members_mobile_key"';
  const shown = publicDbError("test", { message: raw });

  assert.ok(!shown.includes(raw));
  assert.ok(!shown.includes("members_mobile_key"));
  assert.ok(!/constraint|column|relation|violates|null value/i.test(shown));
  assert.ok(shown.length > 0);
});

// Run: node --test --experimental-strip-types lib/
