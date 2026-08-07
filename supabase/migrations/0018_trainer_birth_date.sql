-- ============================================================================
-- Gymlic — Trainer birth date
--
-- Lets a trainer record their birth date on their profile, so the club/app
-- can send a birthday offer or discount. Stored on profiles (not a
-- trainer-only table) for consistency with the rest of the profile fields;
-- the UI only surfaces it for trainer accounts.
-- ============================================================================

alter table profiles add column if not exists birth_date date;
