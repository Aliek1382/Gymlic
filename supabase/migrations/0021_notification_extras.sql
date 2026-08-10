-- ============================================================================
-- Gymlic — First-login profile nudge + platform-wide broadcast notifications
-- ============================================================================

alter table profiles add column is_platform_admin boolean not null default false;

-- ----------------------------------------------------------------------------
-- profiles: role chosen for the first time (choose-role) → nudge the new
-- trainer/athlete to finish their profile. Fires on the INSERT path too
-- (chooseRole upserts, and the profiles row can in principle not exist yet),
-- but only ever once per user: the UPDATE branch is skipped once
-- account_type is already set, so later profile edits don't re-notify.
-- ----------------------------------------------------------------------------

create or replace function notify_profile_role_chosen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.account_type is null or new.account_type = 'club' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.account_type is not null then
    return new;
  end if;

  insert into notifications (recipient_id, type, title, body, link)
  values (
    new.id,
    'complete_profile',
    'پروفایلت رو کامل کن',
    'اطلاعات پروفایلت رو کامل کن تا از آفرهای جذاب بعدی ما استفاده کنی.',
    case new.account_type when 'athlete' then '/profile' else '/settings' end
  );
  return new;
end;
$$;

create trigger profiles_notify_role_chosen
  after insert or update of account_type on profiles
  for each row execute function notify_profile_role_chosen();

-- ----------------------------------------------------------------------------
-- Platform-wide broadcast — gated to profiles flagged is_platform_admin (set
-- by hand in the database; there's no in-app way to grant it). Fans out into
-- one notification row per profile so read state stays per-recipient, same
-- as every other notification kind — no schema change needed to support it.
-- ----------------------------------------------------------------------------

create or replace function create_broadcast_notification(
  p_title text,
  p_body text default null,
  p_link text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from profiles where id = auth.uid() and is_platform_admin
  ) then
    raise exception 'اجازه ارسال اعلان عمومی را ندارید.';
  end if;

  insert into notifications (recipient_id, actor_id, type, title, body, link)
  select id, auth.uid(), 'broadcast', p_title, p_body, p_link
  from profiles;
end;
$$;

grant execute on function create_broadcast_notification(text, text, text) to authenticated;
