-- Plan price — what a member is charged per term.
--
-- Until now the schema carried no price at all, so every "expected" figure was
-- inferred from what the member last paid. That proxy has two failures: a
-- member who has never paid has no expected amount and silently vanishes from
-- every total, and a price change only takes effect after the next payment,
-- which is the one moment you no longer need the estimate.
--
-- Nullable on purpose: null means "fall back to what they last paid", which is
-- exactly the old behaviour, so nothing regresses for a row nobody has set.

alter table members add column if not exists plan_price numeric(10, 2);

-- Backfill from each member's most recent payment — the price that was
-- actually in force for them, and the same number the app was already using.
-- Members with no payment stay null: they are unapproved signups, not debtors,
-- and the amount gets stamped when the owner approves them.
update members m
set plan_price = p.amount
from (
  select distinct on (member_id) member_id, amount
  from payments
  order by member_id, valid_until desc, paid_on desc
) p
where p.member_id = m.id
  and m.plan_price is null;
