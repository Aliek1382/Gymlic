-- ============================================================================
-- Gymlic — Club-side trainer management
--
-- A club had no way to gain a trainer: nothing in the app ever created an
-- invitation with invited_role = 'trainer', and the only accept path a
-- brand-new user has (/join/<code> → accept_athlete_invitation) rejects
-- anything but an athlete invite. So memberships with role 'trainer' only
-- ever appeared if someone wrote them by hand, and the club dashboard's
-- "مربیان فعال" card was structurally stuck at zero.
--
-- This adds the trainer side of the same flow the members page already uses.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- accept_club_invitation — completes a club's trainer invite
--
-- Mirrors accept_athlete_invitation: SECURITY DEFINER so the whole hand-off
-- commits atomically rather than depending on several RLS-gated client calls.
-- Reception invites are rejected: membership_role has the value, but
-- account_type has no persona for it and the panel has no reception UI yet.
-- ----------------------------------------------------------------------------

create or replace function accept_club_invitation(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation invitations%rowtype;
  v_account_type account_type;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'نشست کاربر معتبر نیست.';
  end if;

  select * into v_invitation
  from invitations
  where code = p_code and status = 'pending' and expires_at > now()
  for update;

  if not found
    or v_invitation.club_id is null
    or v_invitation.invited_role <> 'trainer'
  then
    raise exception 'این لینک دعوت معتبر نیست یا منقضی شده است.';
  end if;

  if exists (
    select 1 from memberships
    where club_id = v_invitation.club_id and user_id = v_uid
  ) then
    raise exception 'شما از قبل عضو این باشگاه هستید.';
  end if;

  -- A club owner or an athlete accepting a trainer invite would lose their
  -- own panel the moment account_type flipped, so those accounts are turned
  -- away instead: they need a separate account to work as a trainer.
  select account_type into v_account_type from profiles where id = v_uid;
  if v_account_type is not null and v_account_type <> 'trainer' then
    raise exception 'این حساب از نوع مربی نیست و نمی‌تواند به‌عنوان مربی به باشگاه بپیوندد.';
  end if;

  update profiles
  set account_type = 'trainer',
      first_name = coalesce(first_name, v_invitation.first_name),
      last_name = coalesce(last_name, v_invitation.last_name)
  where id = v_uid;

  -- profiles.phone is unique, so the number the club typed is only copied
  -- over when this profile has none and no other account already claims it.
  if v_invitation.phone is not null and v_invitation.phone <> '' then
    update profiles
    set phone = v_invitation.phone
    where id = v_uid
      and (phone is null or phone = '')
      and not exists (
        select 1 from profiles other
        where other.phone = v_invitation.phone and other.id <> v_uid
      );
  end if;

  insert into memberships (club_id, user_id, role)
  values (v_invitation.club_id, v_uid, 'trainer')
  on conflict (club_id, user_id) do nothing;

  -- Athletes this trainer already works with now train under the club too,
  -- matching what happens for every athlete they invite from now on.
  update trainer_athletes
  set club_id = v_invitation.club_id
  where trainer_id = v_uid and club_id is null;

  insert into memberships (club_id, user_id, role)
  select v_invitation.club_id, ta.athlete_id, 'athlete'
  from trainer_athletes ta
  where ta.trainer_id = v_uid and ta.status = 'active'
  on conflict (club_id, user_id) do nothing;

  update invitations
  set status = 'accepted', accepted_by = v_uid, accepted_at = now()
  where id = v_invitation.id;
end;
$$;

grant execute on function accept_club_invitation(text) to authenticated;

-- ----------------------------------------------------------------------------
-- get_invitation_preview — also report which role is being invited
--
-- /join/<code> has to pick the right accept function before the visitor has
-- any session, and the page's copy differs for a trainer and an athlete.
-- ----------------------------------------------------------------------------

drop function if exists get_invitation_preview(text);

create or replace function get_invitation_preview(p_code text)
returns table (
  first_name text,
  last_name text,
  club_name text,
  invited_role invitation_role
)
language sql
security definer
set search_path = public
stable
as $$
  select i.first_name, i.last_name, c.name, i.invited_role
  from invitations i
  left join clubs c on c.id = i.club_id
  where i.code = p_code and i.status = 'pending' and i.expires_at > now();
$$;

grant execute on function get_invitation_preview(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- trainer_athletes: club managers can read the relations inside their club
--
-- Without this the trainers page could not show how many athletes each
-- trainer has — the owner sees only rows they are personally part of. Scoped
-- to trainer_athletes.club_id, so nothing outside their own club is exposed.
-- ----------------------------------------------------------------------------

drop policy if exists "trainer_athletes_select_club_managers" on trainer_athletes;

create policy "trainer_athletes_select_club_managers" on trainer_athletes
  for select using (
    club_id is not null
    and has_club_role(club_id, array['owner', 'reception']::membership_role[])
  );

-- ----------------------------------------------------------------------------
-- accept_athlete_invitation — same account-type guard
--
-- /join is now reachable while signed in (a trainer already using Gymlic has
-- to accept a club's invite with the account they hold), which means a club
-- owner or trainer can also land on an *athlete* invite link. Without this
-- guard, accepting one would silently flip their account_type to 'athlete'
-- and take their own panel away. The body is otherwise unchanged from 0029.
-- ----------------------------------------------------------------------------

create or replace function accept_athlete_invitation(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation invitations%rowtype;
  v_account_type account_type;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'نشست کاربر معتبر نیست.';
  end if;

  select * into v_invitation
  from invitations
  where code = p_code and status = 'pending' and expires_at > now()
  for update;

  if not found
    or v_invitation.invited_role <> 'athlete'
    or (v_invitation.trainer_id is null and v_invitation.club_id is null)
  then
    raise exception 'این لینک دعوت معتبر نیست یا منقضی شده است.';
  end if;

  select account_type into v_account_type from profiles where id = v_uid;
  if v_account_type is not null and v_account_type <> 'athlete' then
    raise exception 'این حساب از نوع ورزشکار نیست و نمی‌تواند این دعوت را بپذیرد.';
  end if;

  update profiles
  set account_type = 'athlete',
      first_name = coalesce(v_invitation.first_name, first_name),
      last_name = coalesce(v_invitation.last_name, last_name)
  where id = v_uid;

  if v_invitation.phone is not null and v_invitation.phone <> '' then
    update profiles
    set phone = v_invitation.phone
    where id = v_uid
      and (phone is null or phone = '')
      and not exists (
        select 1 from profiles other
        where other.phone = v_invitation.phone and other.id <> v_uid
      );
  end if;

  if v_invitation.trainer_id is not null then
    insert into trainer_athletes (trainer_id, athlete_id, club_id)
    values (v_invitation.trainer_id, v_uid, v_invitation.club_id)
    on conflict (trainer_id, athlete_id) do nothing;
  end if;

  if v_invitation.club_id is not null then
    insert into memberships (club_id, user_id, role, plan_tier)
    values (
      v_invitation.club_id,
      v_uid,
      'athlete',
      coalesce(v_invitation.plan_tier, 'basic'::membership_plan_tier)
    )
    on conflict (club_id, user_id) do nothing;
  end if;

  if v_invitation.height_cm is not null or v_invitation.weight_kg is not null then
    insert into measurements (athlete_id, recorded_by, height_cm, weight_kg)
    values (
      v_uid,
      coalesce(v_invitation.trainer_id, v_invitation.created_by),
      v_invitation.height_cm,
      v_invitation.weight_kg
    );
  end if;

  update workout_assignments
  set athlete_id = v_uid
  where invitation_id = v_invitation.id and athlete_id is null;

  update nutrition_assignments
  set athlete_id = v_uid
  where invitation_id = v_invitation.id and athlete_id is null;

  update invitations
  set status = 'accepted', accepted_by = v_uid, accepted_at = now()
  where id = v_invitation.id;
end;
$$;

grant execute on function accept_athlete_invitation(text) to authenticated;
