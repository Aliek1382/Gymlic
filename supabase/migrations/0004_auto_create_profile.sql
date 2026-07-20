-- ============================================================================
-- Gymlic — Auto-create a profiles row for every new auth.users row.
--
-- Without this, a profile only got created lazily the first time the app's
-- client-side getMyProfile() ran — which nothing actually calls yet. Any user
-- created another way (email/password sign-in, or manually via the Supabase
-- dashboard) never got a profiles row, so account_type stayed permanently
-- null and /choose-role would loop forever (its UPDATE silently affected 0
-- rows). This trigger makes profile creation a database guarantee instead of
-- depending on a specific client code path.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone, email)
  values (new.id, new.phone, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: create profiles for any auth.users created before this trigger
-- existed (e.g. a user added manually from the Supabase dashboard).
insert into public.profiles (id, phone, email)
select u.id, u.phone, u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
