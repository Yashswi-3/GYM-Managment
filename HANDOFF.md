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

**Seen rendered at 375px:** `PendingSignups` (in isolation, fixed props), and
`/join`, `/visit`, `/checkin` — the last against the real dev server, where
the device check fell through to the mobile form rather than auto-checking in,
which is the positive signal that `/join` no longer issues a cookie. Every
input on all three carries a wired `<label>` (`input.labels.length === 1`,
checked, not assumed) and no page overflows horizontally.

**Still not verified:** the admin panel beyond `PendingSignups`. The Supabase
clients are untyped (no `Database` generic), so a green build proves nothing
about column names. Anything touching `approved_at`, `collected`, or
`rejected_at` is only as correct as the migrations and a careful read.

Manual pass still owed, at 375px — all of it writes to the live database,
which is why none of it was done from here:

- [ ] `/join` → new signup appears under "Waiting for your OK"
- [x] `/checkin` shows the form, does **not** auto-check-in (proves the cookie is gone)
- [ ] that mobile at `/checkin` → routed to the visitor form, not a dead end
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

- ~~The three public pages were not redesigned.~~ **Done** — see "Public pages"
  below. What is still open there: `/join` requires an email, and some members
  won't have one; and `normalizeMobile` keeps the *last 10* digits while the
  schema accepts 7, so two short numbers could in principle collide.
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
- **The test runner is `node --test`, and there is exactly one test.**
  `npm test`. No dev dependency was added — Node strips the types itself,
  which is why `allowImportingTsExtensions` is on and why the test imports
  `./dbError.ts` with the extension. `lib/dbError.test.ts` guards one thing:
  that Postgres' own wording can never reach a member's screen. It was
  confirmed to fail when the function is mutated to return `error.message`,
  so it is not a test that cannot fail.

## The Fees dashboard — done 2026-08-11

A fourth tab (`MoneyTab.tsx`), plus a `MoneyCard` on Overview that taps
through to it.

**It is a worklist first, a ledger second.** The first version led with
history, which was the wrong shape: the owner does not open this to read what
happened, he opens it to collect. Every billing product converges on the same
answer — Gymdesk's payments card is *scheduled / received / overdue*, Chargebee
and Stripe age the overdue into buckets, and every element points at a next
action. So the tab opens on **To collect**, grouped and ordered by who to chase
first, with the Fees button on each row.

The worklist rows are ordinary `MemberRowItem` cards. Taking payment from the
worklist is therefore the *same* panel as taking it from the Members tab — a
second way to record money is a second way to record it wrong.

### The three owed-buckets are disjoint, and that is load-bearing

`lib/dues.ts` puts every member in **exactly one** of:

| Bucket | Meaning |
|---|---|
| **Never paid for** | latest payment has `collected = false` — they owe the term they already used |
| **Overdue** | `valid_until` has passed and the last payment *was* collected |
| **Due this month** | `valid_until` falls later this calendar month |

`stillToCollect` is the sum of all three, which is only valid because they do
not overlap. **The first cut got this wrong:** a member past their date whose
last payment was never collected landed in *both* "overdue" and a separate
"not taken" banner, billing the same rupees twice while the banner claimed it
was "counted in neither total". `latestPaymentCollected` is checked first, and
`dues.test.ts` has a regression test for exactly that member.

A member's expected amount is **what they last paid** — the schema stores no
plan price. A member with no payment is not a debtor, they are an unapproved
signup, and is excluded.

**The one rule to not break: every total counts only `collected = true`.**
A payment row with `collected=false` records what is *owed* — an activation
entered as "Payment Not Done" writes one. Summing all rows is exactly the bug
Phase 1 fixed, in the optimistic direction. Money owed is shown in its own
banner and is never added to anything.

Months come from **slicing the ISO string**, not `new Date(...).getMonth()` —
`paid_on` is date-only, so parsing gives UTC midnight, which is the previous
month for anyone west of Greenwich. `lib/money.ts` holds that and is tested
(`npm test`), including the year-boundary walk in `recentMonthKeys`.

**What the schema cannot answer, and so the dashboard does not pretend to:**

- **How a payment was made** — cash / UPI / card is not a column. Yashswi was
  asked and chose not to add one, so the page says so in a footnote rather
  than showing a blank field.
- **Refunds, discounts, partial payments** — no concept of a balance.
- **When a payment was entered.** There is no `created_at` on `payments`, and
  `paid_on` defaults to today and is editable, so a backdated correction
  silently moves money between months. This is the weakest point in the
  ledger; a `created_at` would fix it and is additive.

The bars are a div with a width percentage. Six bars do not need a chart
library, and adding one would be more code than the bars.

## The members table — two buttons, done 2026-08-11

Every row carried **Take payment, Mark not paid, Edit, Delete**, plus the
caption "Based on their last payment." repeated on all of them. That is not
four decisions. The owner is either handling money or correcting a record —
the buttons were grouped by what the server actions can do, not by what he
came here to do.

Now **Fees** and **Edit**:

- **Fees** owns money. Take a payment (amount + term), and "Mark as not paid"
  moved in here, because it is a statement about payment.
- **Edit** owns the record. All the fields, and **Delete at the bottom behind
  a divider** — it is the one irreversible thing here and it was sitting in
  red on all thirty rows. The confirm now names the person and says the
  payment history goes too.

Three things this fixed rather than just moved:

- **"Mark not paid" was rendered on members who had never paid anything.**
  Only "Take payment" was gated on `paymentId`. Pending and rejected rows now
  get no Fees button at all — `recordPayment` does not set `approved_at`, so
  taking money there would leave the member still unable to check in.
  Approving is the "Waiting for your OK" panel's job.
- **"Mark not paid" had no undo.** `setMemberActiveOverride` has always
  accepted `"auto"`, but nothing ever sent it, so a mis-tap could only be
  cleared by recording a payment that never happened. Fees now offers
  "Undo — they have paid".
- **Every mobile card carried 36px of dead space between blocks.** `Card` is
  `flex flex-col gap-6`; a `space-y-3` on it does not replace that gap, it
  adds to it. Cards went 316px → 268px, and a member with no payment on file
  (four facts reading "—") went to 179px.

The Payment column is gone, so the table is 10 columns and `colSpan` is 10 —
if you add a column, both `MembersTable` headers and the two `colSpan={10}`
in `MemberRowItem` have to move together.

## Public pages — done 2026-08-11

`/join`, `/visit`, `/checkin`. The layout was already right (single column,
`max-w-sm`, full-width buttons), so it was left alone. Four real defects were
fixed instead:

1. **Raw database errors were rendered to members** at four call sites —
   `error.message` is Postgres' own text and names constraints and columns.
   Now routed through `publicDbError()` in `lib/dbError.ts`, which logs the
   real thing server-side and returns one plain sentence. Same one-chokepoint
   shape as `findApprovedMemberByMobile`.
2. **Every input was placeholder-only** — no `<label>` anywhere, so the
   placeholder was the only hint what a box was for, and it disappears the
   moment you type. A screen reader had nothing at all.
3. **A server-side validation failure redirects and wipes the whole form.**
   Native constraints (`type`, `pattern`, `required`) now catch typos in the
   browser, so the round-trip that costs a member all three fields is rare
   rather than routine. The mobile pattern deliberately accepts `+`, `-` and
   spaces, because `lib/phone.ts` strips them anyway.
4. **The approval gate had made two screens lie.** `/join`'s success screen
   didn't say you cannot check in until the owner confirms you, and
   `/checkin`'s visitor stage greeted a waiting signup with "First time
   here?" — both now say what is actually true.
