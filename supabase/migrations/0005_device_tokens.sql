-- Remembered-device flow: an opaque token (never the mobile number) stored
-- in a long-lived cookie on the member's own phone, resolved back to a
-- member here so returning to /checkin can skip the form entirely.
create table if not exists device_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  member_id uuid not null references members(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists device_tokens_token_idx on device_tokens (token);

alter table device_tokens enable row level security;

create policy "admin full access - device_tokens" on device_tokens
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- No policy for anon, matching every other table: the public /checkin and
-- /join pages only ever touch this table through the service-role client in
-- server actions, never with direct anon-key access.
