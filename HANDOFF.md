# Handoff — approval gate, payment truthfulness, mobile rewrite, fees book

Written 2026-08-11 and shipped the same day across five pushes
(`44eb3e9..4576683`), then the fees book was rebuilt around the calendar month
later the same day (uncommitted at the time of writing). Migrations `0010`-`0012`
**were applied to the live database by hand before any of that code was
committed**, so the schema is ahead of `main`'s history rather than behind it.
**`0013` has not been applied and the new code does not run without it.**

Read this before touching the admin panel, the check-in flow, or any number
with a rupee sign in front of it.

**The three rules everything else hangs off:**

1. **Approval is `members.approved_at`** — never "has payment rows".
2. **Money in counts only `collected = true`; money owed is derived from
   memberships, never from payment rows.** Mixing those is how the owner's
   headline number goes wrong, and it has gone wrong twice already.
3. **Members are billed on their own renewal date and reported by calendar
   month.** A term ending 12 August is August's money. Confirmed by the owner
   2026-08-11. Anything that asks "is this paid" must say *for which month*.

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
| `0013_member_plan_price.sql` | `members.plan_price numeric(10,2)` + backfill | ❌ **not yet** |

> **`0013` must be applied before this code is deployed.** `app/admin/page.tsx`
> selects `plan_price`; against a database without the column Supabase fails the
> whole select and the admin page renders empty. It is additive and the backfill
> only writes rows where `plan_price is null`, so re-running it is safe.

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
4. **Group controls by what the owner came to do**, not by what the server
   actions can do. That is the whole of the two-button members row below.
5. **Never `space-y-*` on a `Card`.** It is `flex flex-col gap-6`, so a
   `space-y-3` *adds* 12px to the existing 24px instead of replacing it. Set
   the flex gap (`className="... gap-3"`). This cost 36px per card on every
   member card before anyone noticed.

`app/admin/NeedsYou.tsx` is the home screen and answers exactly one question —
what needs the owner today. Rows with a count of zero are dropped rather than
rendered as "0".

**"N members have not paid" was removed from it.** It counted anyone without a
payment dated inside the current calendar month, so on the 1st it read as the
entire gym and decayed all month. A number that starts at maximum and falls on
its own is a calendar artefact, not a task. Who owes money is a monthly
question and it is answered per month in the fees book.

**The Overview is six square tiles and nothing else.** The full-width `MoneyCard`
that used to sit above the grid is gone — it broke the row of squares and
duplicated the fees tab at lower fidelity. The sixth tile is collected-this-
month and taps through to Fees. `StatsCards` is `grid-cols-2 sm:grid-cols-3`,
so six tiles always fill complete rows at both widths.

**The status badge answers "can they train today", not "have they paid".**
`active` reads "Active", not "Paid" — with a fees worklist in the app the old
label contradicted itself, putting a green "Paid" directly above "₹2,500
expected" for a member whose term runs to the 19th. `expired` reads "Membership
ended". `inactive` keeps "Not paid" because it is the one status the owner sets
by hand, to say the money did not come.

## Verified, and not

**Passed:** `tsc --noEmit`, `npm run lint`, a full `next build` from a wiped
`.next`, and every post-migration row count queried directly.

**Seen rendered at 375px and 1400px:** `/join`, `/visit`, `/checkin` against
the real dev server — the device check fell through to the mobile form rather
than auto-checking in, which is the positive signal that `/join` no longer
issues a cookie; every input carries a wired `<label>`
(`input.labels.length === 1`, checked, not assumed). And `PendingSignups`,
`MembersTable` and `MoneyTab` mounted on a throwaway route with fixed props
covering every status and every owed bucket.

**How to do that yourself, because it is the only way to see the admin panel
without logging in.** Drop a `"use client"` page at `app/preview-tmp/page.tsx`
that renders the component with hand-written props, look at it, then delete the
route and confirm it is absent from the `next build` route list.

> **Use Playwright, not the editor's browser pane.** The pane stopped
> compositing mid-session and every `getBoundingClientRect` silently returned
> 0 — `document.visibilityState` was `hidden`, which leaves Next's streamed
> content in its `display:none` container. Chromium is already cached at
> `~/AppData/Local/ms-playwright`; a ten-line script renders headlessly, takes
> real screenshots and cannot lie about geometry this way.

**Still not verified:** anything against real data. The Supabase clients are
untyped (no `Database` generic), so a green build proves nothing about column
names. Anything touching `approved_at`, `collected`, `rejected_at` or
`latestPaymentCollected` is only as correct as the migrations and a careful
read.

Manual pass still owed, at 375px — all of it writes to the live database,
which is why none of it was done from here:

- [ ] `/join` → new signup appears under "Waiting for your OK"
- [x] `/checkin` shows the form, does **not** auto-check-in (proves the cookie is gone)
- [ ] that mobile at `/checkin` → routed to the visitor form, not a dead end
- [ ] Approve → `/checkin` succeeds
- [ ] Reject → drops out of pending, shows Rejected, Restore puts it back
- [ ] Add member with "Payment Not Done" → "Paid this month" does not move

Added by the month rebuild, and **all of it depends on migration `0013` being
applied first**:

- [ ] Admin loads at all — proves `plan_price` exists in the database
- [ ] Fees opens on the current month with four numbers that add up:
      `Expected = Collected + Still to collect`
- [ ] Take a payment from the worklist → the member moves from "Not paid" to
      "Received", Collected rises, **Expected does not change**. This is the
      one behaviour the whole rewrite is for.
- [ ] `◀` to last month → its totals are the same before and after the payment
      above, and no arrears block is shown on a past month
- [ ] A member card shows plausible "came this month / last month" day counts

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
- ~~There is no plan price.~~ **Done** — `members.plan_price`, migration `0013`,
  stamped on every money path. What is still open: a member who has never paid
  and has never had a price set is excluded from Expected rather than counted
  as zero, because guessing their fee would be worse than admitting it is
  unknown. They are unapproved signups, so approving them fixes it.
- **28 pending signups is ~10 screens of scroll**, and the members list has
  the same shape at 31. Nothing paginates. A "show 10, load more" is a few
  lines; it has not been done because he has not said the list is a problem.
- **Nothing is server-paginated either** — `app/admin/page.tsx` selects every
  member, payment, attendance row and visitor on each load, and ships them all
  to the client. Fine at 31 members, not at 500.
- **The test runner is `node --test` and there are 17 tests.** `npm test`. No
  dev dependency — Node strips the types itself, which is why
  `allowImportingTsExtensions` is on in `tsconfig.json` and why these files
  import each other **with the `.ts` extension** (`./money.ts`). Drop the
  extension and `node --test` stops resolving the module.
  - `lib/dbError.test.ts` — Postgres' own wording can never reach a member's
    screen. Confirmed to fail when the function is mutated to return
    `error.message`, so it is not a test that cannot fail.
  - `lib/money.test.ts` — month keys, the year-boundary walk, rupee format.
  - `lib/fees.test.ts` — the month book. The one that matters is *"recording a
    payment moves a member without changing what the month expected"*; the rest
    pin the price fallback, arrears staying out of the month, and a member with
    both a taken and untaken payment being counted once.
  - `lib/attendance.test.ts` — distinct days, and that the day is local rather
    than UTC (a 6am check-in in India is the previous date in UTC).
  They cover the money maths, not the UI. There is still no component test.

## The Fees dashboard — rebuilt around the month, 2026-08-11

The fourth tab (`MoneyTab.tsx`). **`lib/dues.ts` is gone; `lib/fees.ts`
replaces it.**

### Why it was rebuilt: the app was running two billing models at once

"Paid this month" counted a payment dated inside the current calendar month.
The Fees buckets asked whether `valid_until` had passed. Those are *calendar*
and *anniversary* billing respectively, and a member who joined on the 12th sat
in both: "not paid" on the Overview and "not due yet" in Fees, on the same day,
on the same person. No amount of restyling fixes a screen whose two halves
disagree about what a month is.

Settled with the owner: **billing is on each member's renewal date, reporting
is by calendar month.** One model, and it is the one the schema already stored.

### The identity the whole tab hangs off

For any month M, `buildMonthBook()` puts every rupee in exactly one place:

| | |
|---|---|
| **collected** | payments dated in M with `collected = true` |
| **notTaken** | payments dated in M with `collected = false` |
| **stillToCollect** | members whose term ends in M with no payment in M |

```
expected = collected + notTaken + stillToCollect
```

**Recording a payment moves a member from `stillToCollect` into `collected` and
leaves `expected` untouched.** That is the property the old design lacked: it
derived what was due from live `valid_until`, so the headline shrank every time
someone paid. A total that falls as you work it cannot be a target, and cannot
answer "what was August worth". `fees.test.ts` pins this — it is the test to
keep if you keep only one.

Money owed is counted per member, money in per payment, so the identity holds
even when one member has both a taken and an untaken payment inside one month.

**Arrears are deliberately outside the month.** `arrears()` lists terms that
ended before M and were never renewed. Folding them into M's total would mean
August's figure changed depending on when you looked at it, and a month whose
number moves after the fact is not a record of anything. Shown only against the
current month.

### The tab

A month selector at the top (`◀ Aug 2026 ▶`, capped at the current month) frames
everything below it. Four tiles — **Expected / Collected / Still to collect /
Members paid (n of m)** — then three sections: **Not paid** (the worklist plus
the arrears block), **Received** (that month's payments), **Trend** (six bars,
tap one to jump to that month, plus all-time).

Worklist rows are ordinary `MemberRowItem` cards, so recording a payment is the
same panel everywhere — a second way to record money is a second way to record
it wrong. In worklist context the card drops to four facts (ends on, last visit,
came this month, came last month): eight facts per row is what made the list
unreadable, and how much and how late are already in the note above them.

### Plan price, and what it fixed

`members.plan_price` (migration `0013`) is what a member is charged.
`expectedAmount()` reads it, falls back to what they last paid, and returns null
if neither exists — a member with no price signal is excluded rather than
counted as zero. It is stamped on every money path (`activatePendingMember`,
`addMemberWithPayment`, `recordPayment`, and the amount field in
`updateMember`), so it stays current without anyone maintaining a price list,
and the one or two members on a different rate stay right automatically.

**What the schema still cannot answer, so the page does not pretend to:**

- **How a payment was made** — cash / UPI / card is not a column. The owner was
  asked and chose not to add one, so the page says so in a footnote.
- **Refunds, discounts, partial payments** — no concept of a balance. The owner
  ruled out partial payments explicitly.
- **When a payment was entered.** No `created_at` on `payments`, and `paid_on`
  defaults to today and is editable, so a backdated correction silently moves
  money between months. Still the weakest point in the ledger; additive to fix.

Months come from **slicing the ISO string**, not `new Date(...).getMonth()` —
`paid_on` is date-only, so parsing gives UTC midnight, which is the previous
month for anyone west of Greenwich. `lib/money.ts` holds that and is tested.
`page.tsx`'s `paidThisMonth` was the one place still parsing the date; it now
uses `monthKey` like everything else.

The bars are a div with a width percentage. Six bars do not need a chart
library, and adding one would be more code than the bars. **Not built on
shadcn's `dashboard-01`** — it brings Recharts, TanStack Table and a desktop
sidebar that fights the phone-first bottom nav.

Months come from **slicing the ISO string**, not `new Date(...).getMonth()` —
`paid_on` is date-only, so parsing gives UTC midnight, which is the previous
month for anyone west of Greenwich. `lib/money.ts` holds that and is tested
(`npm test`), including the year-boundary walk in `recentMonthKeys`.

**Not built on shadcn's `dashboard-01`**, which was the obvious thing to copy.
It brings Recharts, TanStack Table and a desktop sidebar that fights the
phone-first bottom nav — copying it would have added code, not saved it. The
pattern was taken; no dependency was.

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
