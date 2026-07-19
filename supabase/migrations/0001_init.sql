-- Gym management MVP — initial schema
-- Matches /project-docs/02_Requirements.md

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mobile text not null unique,
  join_date date not null default current_date,
  plan_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  amount numeric(10, 2) not null,
  paid_on date not null default current_date,
  valid_until date not null
);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  checked_in_at timestamptz not null default now()
);

create table if not exists visitors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mobile text not null,
  visited_on timestamptz not null default now(),
  converted_member_id uuid references members(id) on delete set null
);

create table if not exists notification_log (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  trigger_type text not null check (
    trigger_type in ('expiry_3', 'expiry_2', 'expiry_1', 'inactive_7')
  ),
  sent_at timestamptz not null default now(),
  -- FR12: one email per member/day/trigger-type, so a job re-run never double-sends
  unique (member_id, trigger_type, sent_at)
);

-- Practically we key uniqueness off the *day* the trigger fired, not the exact
-- timestamp, so add a generated date column with its own uniqueness constraint.
alter table notification_log add column if not exists sent_on date generated always as ((sent_at at time zone 'utc')::date) stored;
alter table notification_log drop constraint if exists notification_log_member_id_trigger_type_sent_at_key;
create unique index if not exists notification_log_unique_per_day
  on notification_log (member_id, trigger_type, sent_on);

create index if not exists payments_member_id_idx on payments (member_id);
create index if not exists payments_valid_until_idx on payments (valid_until);
create index if not exists attendance_member_id_idx on attendance (member_id);
create index if not exists attendance_checked_in_at_idx on attendance (checked_in_at);
create index if not exists visitors_mobile_idx on visitors (mobile);

-- Row-Level Security ---------------------------------------------------------
-- Only the authenticated admin (the gym owner's Supabase Auth account) can
-- read or write these tables directly. The public check-in page never talks
-- to these tables with the anon key — it goes through server actions / route
-- handlers that use the service-role key after validating input server-side.
-- This is what satisfies NFR5: the check-in page can't read another member's
-- data, because it has no direct table access at all.

alter table members enable row level security;
alter table payments enable row level security;
alter table attendance enable row level security;
alter table visitors enable row level security;
alter table notification_log enable row level security;

create policy "admin full access - members" on members
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin full access - payments" on payments
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin full access - attendance" on attendance
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin full access - visitors" on visitors
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin full access - notification_log" on notification_log
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- No policies are created for the anon role, so by default it has zero
-- access to any of these tables (RLS default-denies).
