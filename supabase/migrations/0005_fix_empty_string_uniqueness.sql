-- ============================================================================
-- Gymlic — Fix "duplicate key value violates unique constraint profiles_phone_key"
--
-- Supabase Auth returns user.phone / user.email as an empty string ('') for
-- identifiers a user didn't sign up with, not null. Every place that wrote
-- these back to profiles used `?? null`, which only replaces null/undefined —
-- so every email-only user ended up with phone = '' (a real, non-null value)
-- instead of NULL. Postgres UNIQUE constraints treat NULL as always distinct,
-- but treat '' as a normal value, so the second such user collided on
-- profiles_phone_key / profiles_email_key. The application code has been
-- fixed to normalize empty strings to null before writing; this migration
-- fixes the trigger (the other write path) and cleans up existing bad rows.
-- ============================================================================

update public.profiles set phone = null where phone = '';
update public.profiles set email = null where email = '';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone, email)
  values (new.id, nullif(new.phone, ''), nullif(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
