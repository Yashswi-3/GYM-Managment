-- Add remarks column to visitors for visitor notes/feedback
alter table visitors add column if not exists remarks text;