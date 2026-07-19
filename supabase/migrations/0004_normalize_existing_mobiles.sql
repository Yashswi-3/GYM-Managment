-- Bug fix: mobile-number matching at check-in was an exact string match, so
-- the same person typing their number slightly differently between visits
-- (with/without +91, spaces, dashes) would never match their own record and
-- would be treated as a brand-new visitor every single day. lib/phone.ts's
-- normalizeMobile() now normalizes on every read/write going forward; this
-- migration normalizes whatever was already stored before that fix existed.
--
-- CAVEAT: if two different-looking numbers already in the table normalize
-- to the same 10 digits (e.g. genuine duplicate test data), this update can
-- hit the members.mobile unique constraint. If it fails, find and manually
-- resolve the collision first with:
--   select mobile, right(regexp_replace(mobile, '\D', '', 'g'), 10) as normalized
--   from members group by mobile having count(*) > 1;
update members
set mobile = right(regexp_replace(mobile, '\D', '', 'g'), 10)
where mobile <> right(regexp_replace(mobile, '\D', '', 'g'), 10);

update visitors
set mobile = right(regexp_replace(mobile, '\D', '', 'g'), 10)
where mobile <> right(regexp_replace(mobile, '\D', '', 'g'), 10);
