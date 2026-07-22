-- Adds a 4th expiry notification trigger for the day the membership actually
-- lapses (0 days remaining), completing the 3/2/1/0 sequence. Previously the
-- job only warned at 3, 2, and 1 day(s) remaining and stayed silent once the
-- membership had actually expired.
alter table notification_log drop constraint if exists notification_log_trigger_type_check;
alter table notification_log add constraint notification_log_trigger_type_check check (
  trigger_type in ('expiry_3', 'expiry_2', 'expiry_1', 'expiry_0', 'inactive_7')
);
