-- "Payment Not Done" was being counted as paid. Both activation flows insert a
-- payments row regardless, deliberately, so the table still shows what's owed
-- and by when (see markPaymentIncompleteAndNotify) — but "Paid this month"
-- counts any payment row dated this month, so an uncollected one inflates it.
--
-- A column rather than skipping the insert: skipping deletes the amount and
-- due-date the owner just typed. `default true` keeps every existing row
-- meaning exactly what it already meant, so this migration changes no numbers.
alter table payments add column if not exists collected boolean not null default true;
