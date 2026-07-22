-- Security hardening: the existing "admin full access" policies allowed ANY
-- authenticated Supabase session (auth.role() = 'authenticated'), not just
-- the single gym owner. If public signup were ever enabled on this project,
-- anyone could self-register and gain full read/write/delete on all member,
-- payment, and attendance data. Locking to the specific owner UID removes
-- that dependency entirely, regardless of the signup setting.
alter policy "admin full access - members" on public.members
  using (auth.uid() = 'f51e7a82-392c-4baa-a823-f8f7b67be81d'::uuid)
  with check (auth.uid() = 'f51e7a82-392c-4baa-a823-f8f7b67be81d'::uuid);

alter policy "admin full access - payments" on public.payments
  using (auth.uid() = 'f51e7a82-392c-4baa-a823-f8f7b67be81d'::uuid)
  with check (auth.uid() = 'f51e7a82-392c-4baa-a823-f8f7b67be81d'::uuid);

alter policy "admin full access - attendance" on public.attendance
  using (auth.uid() = 'f51e7a82-392c-4baa-a823-f8f7b67be81d'::uuid)
  with check (auth.uid() = 'f51e7a82-392c-4baa-a823-f8f7b67be81d'::uuid);

alter policy "admin full access - visitors" on public.visitors
  using (auth.uid() = 'f51e7a82-392c-4baa-a823-f8f7b67be81d'::uuid)
  with check (auth.uid() = 'f51e7a82-392c-4baa-a823-f8f7b67be81d'::uuid);

alter policy "admin full access - notification_log" on public.notification_log
  using (auth.uid() = 'f51e7a82-392c-4baa-a823-f8f7b67be81d'::uuid)
  with check (auth.uid() = 'f51e7a82-392c-4baa-a823-f8f7b67be81d'::uuid);

alter policy "admin full access - device_tokens" on public.device_tokens
  using (auth.uid() = 'f51e7a82-392c-4baa-a823-f8f7b67be81d'::uuid)
  with check (auth.uid() = 'f51e7a82-392c-4baa-a823-f8f7b67be81d'::uuid);
