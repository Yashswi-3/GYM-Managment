-- Add is_active column to members for manual active/inactive override
-- null = derived from payment status (current behavior)
-- true = forced active
-- false = forced inactive
alter table members add column if not exists is_active boolean default null;
create index if not exists members_is_active_idx on members (is_active);