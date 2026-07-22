hi## Project
Gym management MVP — a lightweight web app for a single gym: admin panel (members, payments, attendance), QR-code check-in for members and visitors, and automated email notifications for upcoming expiry and inactivity. Building for a demo, not scale.

## Stack
- Next.js (App Router), TypeScript throughout — no plain .js files
- Supabase: Postgres + Auth + Row-Level Security (no Clerk, no Stripe — both removed from the forked base)
- Vercel hosting; Vercel Cron (see vercel.json) drives the daily notification job
- Resend for transactional email
- Base repo: forked from andrew-dev-p/supabase-gym-app — dashboard shell, Supabase client setup, and shadcn/ui components were the starting point

## The rule that overrides everything else: reuse before you write
Before writing any new function, component, or utility:
1. Check if this repo already has something close — extend it, don't duplicate it
2. Check npm for an existing, well-maintained package that solves it
3. Only hand-write logic that's genuinely specific to this app — the notification trigger rules, the visitor-conversion check

If a task starts generating more than ~30-40 lines for something that isn't unique business logic, stop and look for a library first. Already in place: qrcode (QR), date-fns (date math), zod (validation), resend (email), shadcn/ui (all dashboard UI).

## Data model (supabase/migrations/)
members, payments, attendance, visitors, notification_log — see 0001_init.sql, 0002_member_email.sql, 0003_visitor_email_pending_members.sql. Membership status is always derived from the latest payment's valid_until (lib/status.ts) — never stored as a separate field. notification_log's unique (member_id, trigger_type, sent_on) index is what makes the daily job idempotent.

Known gaps fixed beyond the original data model:
- 0002: members had no email column, but FR10/FR11 need one to email the member directly. Nullable — a member without an email just won't get their own copy.
- 0003: visitors gained an email column (self-registration collects it), and members.plan_name is now nullable to support "pending" members (see below).

## Three public QR entry points
- /checkin — daily attendance. Recognized mobile -> attendance row. Unrecognized -> visitor registration (FR5/FR8).
- /join — new member self-signup (name, mobile, email only). Creates a member row with no plan/payment ("pending" status). The admin's Pending Signups panel (app/admin/PendingSignups.tsx) is where the plan + first payment get added — the admin never types the name/mobile.
- /visit — dedicated visitor self-registration, separate poster from check-in. If the mobile already belongs to a member, it just tells them so instead of creating a duplicate visitor row.

## Design system
Dark theme only (Tailwind v4 CSS variables in app/globals.css) — "Bold Signal" direction: confident, high-impact, a saturated signal-red/orange accent used as a solid block (`.signal-block` class — see the home hero), not just a highlight color. Display font: Oswald (headings, h1-h4 auto-styled via the base layer). Body font: Inter. Gym name/tagline set in lib/site.ts (currently "Being Fit" — the real client). The `.barbell-divider` CSS class still exists as an optional secondary motif if needed elsewhere, but the hero's primary signature element is now the vibrant `.signal-block`.

## Admin panel structure (app/admin/)
Tabbed via AdminTabs.tsx (client-side, no route change): Overview (stats, all three QR posters, recent check-in activity feed), Members (pending signups, add-member-with-payment form, members table), Visitors (manual add form, visitor list with conversion status). page.tsx does all the data fetching/derivation server-side and passes plain props down — no client-side Supabase calls in the admin panel.

## Auth model
Single gym owner = the only Supabase Auth user. Any authenticated session is treated as admin (no roles table — not needed for a single-tenant MVP). The public /checkin route has zero direct table access; all its reads/writes go through server actions using the service-role key (app/checkin/actions.ts), which is what satisfies NFR5.

## Workflow expectations
- Use plan mode for anything beyond a one-line fix
- Keep sessions scoped to one piece of work
- All membership/payment status logic runs server-side — never in the browser
- Schema changes go through the Supabase MCP server (https://mcp.supabase.com/mcp) pointed at the dev project only, never production

## Before marking anything done
- Run `npm run lint` and `npm run build` and confirm both pass
- Check the change against the relevant user story's acceptance criteria in /project-docs/01_PRD.md
- If a new npm dependency was added, note why nothing already in the repo could cover it

## Phone number handling
Mobile numbers are normalized (lib/phone.ts's normalizeMobile — digits only, last 10 kept) on every read and write, everywhere a mobile number is matched or stored. This fixes a real bug: exact-string matching meant the same person typing "+91 98765 43210" one day and "9876543210" the next was never recognized as the same member, and fell through to "unrecognized visitor" every time. Migration 0004 is a one-time cleanup of already-stored inconsistent numbers.

## Remembered-device check-in (lib/deviceToken.ts)
After a successful /join signup or a successful manual mobile-number check-in, the browser gets an opaque random token in a long-lived (~400 day), httpOnly cookie, mapped server-side to that member_id in the device_tokens table (migration 0005). On every future /checkin page load, attemptDeviceCheckIn() tries this cookie first — if it resolves, attendance is logged immediately with zero taps and zero typing, before the mobile-entry form ever shows. Falls back to the normal form for new phones, cleared cookies, or shared devices. Deliberately not tied to biometrics or any new QR/route — same poster, same three QR codes as before.

---

# Behavioral guidelines to reduce common LLM coding mistakes

Source: [andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills). Merge with the project-specific instructions above.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
