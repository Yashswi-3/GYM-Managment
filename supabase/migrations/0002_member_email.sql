-- Gap found while implementing the notifications module: 02_Requirements.md's
-- members table (id, name, mobile, join_date, plan_name, created_at) has no
-- email column, but FR10/FR11 require sending an email to the member
-- directly. Adding it here as nullable so the check-in flow (which only
-- collects name + mobile per 00_Project_Overview.md's explicit scope) still
-- works — a member without an email on file simply won't get the member-side
-- copy of the notification, but the owner's copy still goes out.
alter table members add column if not exists email text;
