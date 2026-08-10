# Handoff — approval gate, payment truthfulness, mobile rewrite

Written 2026-08-11, pushed the same day. The three migrations **were applied to
the live database by hand before this code was committed**, so the schema is
ahead of `main`'s history rather than behind it.

Read this before touching the admin panel or the check-in flow.

---

## Why any of this happened

`/join` inserted straight into `members`. "Pending" was never a state — it was
inferred at render time from *"has zero payment rows"*. That made a mis-scan
structurally identical to a real member everywhere else in the app, with three
consequences that were all live in production:

1. An unapproved signup could check in forever.
2. Worse — `/join` handed out a remembered-device cookie immediately, so an
   unapproved signup got **zero-tap** daily check-in.
3. "Payment Not Done" still inserted a `payments` row, and "Paid this month"
   counted any payment this month. The owner's headline number was wrong, in
   the optimistic direction.

Measured on the live database before the change: **31 members, 3 with a
payment, 28 with none — and all 28 were holding a check-in cookie.** None of
the 28 had ever checked in, which is why closing the hole locked nobody out.

## Database

| Migration | Adds | Applied |
|---|---|---|
| `0010_member_approval.sql` | `members.approved_at timestamptz` + backfill | ✅ |
| `0011_payment_collected.sql` | `payments.collected boolean not null default true` | ✅ |
| `0012_member_rejected.sql` | `members.rejected_at timestamptz` | ✅ |

All three are additive. Nothing was deleted or moved — `count(*)` on `members`
was 31 before and after. `0010`'s backfill approves exactly those members who
already had a payment, which reproduces the old dashboard behaviour precisely,
so applying it changed nothing visible.

Reverting is `alter table … drop column …`; the backfill goes with the column
because it wrote to a column that did not previously exist.

> **The repo's `CLAUDE.md` says schema changes go to a dev project, never
> production.** There is no dev project on the account — there is one Supabase
> project and it is production. That line needs correcting or a dev project
> needs creating; right now it describes a workflow nobody can follow.

## Where the logic lives

**One chokepoint for "may this person check in":**
`findApprovedMemberByMobile()` in `app/checkin/actions.ts`. Used by
`lookupMobile`, `checkInMember`, and `registerVisitor`'s race guard. If you add
a fourth caller that asks the same question, route it through this — three
hand-rolled copies of the question is why the gate was missing in the first
place.

The device-cookie path can't use it (keyed by token, not mobile), so its gate
is in `resolveDeviceToken()` in `lib/deviceToken.ts`. **`/join` no longer
issues device cookies at all** — that was the zero-tap hole.

**Approval is `members.approved_at`, not "has payments".** Both derivations in
`app/admin/page.tsx` key off it. A rejected row keeps `approved_at IS NULL`, so
check-in already refuses it; `rejected_at` only controls whether it shows in
the pending list.

**Rejecting is scoped in the query**, not just hidden in the UI —
`setMemberRejected` adds `.is("approved_at", null)` on the reject path, so a
stale browser tab can't reject someone already approved.

## UI conventions introduced

The owner is non-technical and uses this **only on a phone**. Three rules came
out of that, and new UI should follow them:

1. **44px minimum touch targets.** Enforced in the `size` variants of
   `components/ui/{button,input,select}.tsx` (`min-h-11`, relaxing from `md`
   up), not at call sites. Don't reintroduce a fixed `h-8`/`h-9`.
2. **Plain words, never system words.** "Not paid", not "Payment Incomplete".
   "Waiting for your OK", not "Pending signup". "Take payment", not "Renew".
   A control says what happens when it's used.
3. **One decision per control.** `PlanDuration.tsx` is the pattern: pick a
   term, pick a start date, and the end date is *shown*, not asked for.

`app/admin/NeedsYou.tsx` is the home screen and answers exactly one question —
what needs the owner today. Rows with a count of zero are dropped rather than
rendered as "0".

## Verified, and not

**Passed:** `tsc --noEmit`, `npm run lint`, a full `next build` from a wiped
`.next`, and every post-migration row count queried directly.

**Not verified — this matters:** only `PendingSignups` has been seen rendered
(in isolation, against fixed props, not against the database). The rest has
not. The
Supabase clients are untyped (no `Database` generic), so a green build proves
nothing about column names. Anything touching `approved_at`, `collected`, or
`rejected_at` is only as correct as the migrations and a careful read.

Manual pass still owed, at 375px:

- [ ] `/join` → new signup appears under "Waiting for your OK"
- [ ] `/checkin` shows the form, does **not** auto-check-in (proves the cookie is gone)
- [ ] that mobile at `/checkin` → not found
- [ ] Approve → `/checkin` succeeds
- [ ] Reject → drops out of pending, shows Rejected, Restore puts it back
- [ ] Add member with "Payment Not Done" → "Paid this month" does not move

## Local setup

`.env.local` is gitignored; copy `.env.example` and fill it from the Supabase
dashboard (Project Settings → API Keys) and Resend.

```bash
npm install && npm run dev
```

**Keep `RESEND_API_KEY` as a dummy value locally.** A real key plus a real
`OWNER_EMAIL` means a test activation emails actual members. Email failures are
now caught in `markPaymentIncompleteAndNotify`, so a dummy key won't break the
flow — it just won't send.

## Known gaps

- **The three public pages (`/join`, `/checkin`, `/visit`) were not
  redesigned.** They inherit the global touch fixes only. Members are also
  non-technical and also on phones.
- ~~Pending rows still need a card layout at 375px.~~ **Done** — `PendingSignups`
  stacks below `md` and keeps the single row above it. Measured at 375px: every
  control full-width and 44px tall, no horizontal overflow.
- **The term start date is not stored.** It only computes the end date;
  `paid_on` still defaults to today. Writing a backdated start into `paid_on`
  would drop the member out of "Paid this month" the moment they paid.
- **The daily cron writes its `notification_log` row before sending**, so a
  Resend failure marks an email sent that never went. Pre-existing; the
  equivalent bug on the admin path is fixed.
- **`plan_name` history is inconsistent** — `Month`, `monthly`, `monthly`.
  The term picker stops it spreading but does not clean up what's there.
- **No test runner in this repo.** Adding one means a new dev dependency; it
  hasn't been done rather than done quietly.
