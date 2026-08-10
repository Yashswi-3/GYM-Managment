-- /join inserts straight into members, so every scan — mis-scan, curious
-- walk-in, someone who changed their mind — is a permanent member row.
-- "Pending" was never a state; it was inferred at render time from "has zero
-- payment rows", which makes an unapproved signup structurally identical to a
-- real member everywhere else in the app (notably /checkin).
--
-- A column, not a separate signup_requests table: a separate table means
-- moving existing rows, and a migration that moves rows is a migration that
-- can lose them. This one adds a column and deletes nothing.
alter table members add column if not exists approved_at timestamptz;

-- Anyone with a payment on file is already treated as a real member by the
-- dashboard. Approving exactly those reproduces today's behaviour precisely:
-- members with zero payments keep approved_at IS NULL, keep showing up under
-- Pending signups, and are visually unchanged. Zero behaviour change on deploy.
update members m set approved_at = m.created_at
where exists (select 1 from payments p where p.member_id = m.id)
  and m.approved_at is null;
