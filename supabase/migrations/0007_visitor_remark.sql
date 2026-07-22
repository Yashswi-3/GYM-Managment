-- Feature 1: Visitor remark field
-- Free-text note entered by visitor during self-registration or by admin
alter table visitors add column if not exists remark text;