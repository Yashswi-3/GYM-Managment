-- Feature 3: Member active/inactive override
-- Allows admin to manually set a member as active/inactive regardless of payment status
-- When is_active_override is null (default), status is derived from latest payment's valid_until
-- When true, member shows as "Active" even if expired
-- When false, member shows as "Inactive" even if payment is valid
alter table members add column if not exists is_active_override boolean;