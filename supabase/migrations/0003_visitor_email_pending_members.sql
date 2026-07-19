-- Phase 2 structural additions:
-- 1) visitors.email — the new visitor self-registration QR collects name,
--    mobile, and email, matching the member self-signup flow.
-- 2) members.plan_name made nullable — the new /join self-signup flow
--    creates a member with no plan/payment yet ("pending"); the admin fills
--    plan + payment in when they activate the signup from the dashboard.
alter table visitors add column if not exists email text;
alter table members alter column plan_name drop not null;
