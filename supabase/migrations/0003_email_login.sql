-- ============================================================================
-- Gymlic — Email as a second login identifier alongside phone/OTP.
-- Lets a user sign in/up with email + OTP until an SMS provider is connected.
-- ============================================================================

alter table profiles
  add column email text unique;
