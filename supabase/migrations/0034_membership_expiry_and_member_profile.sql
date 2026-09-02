-- ============================================================================
-- Gymlic — Membership expiry, and what a club may see on a member's profile
--
-- A membership had no end date at all. Every plan a club sells runs for a
-- fixed number of days (club_membership_plans.duration_days since 0033), but
-- nothing recorded when a member's term actually ends — so a club could not
-- see who is about to lapse, which is the number a gym's revenue depends on
-- most.
--
-- The member profile page needs a little more reach than a club manager had:
-- until now they could see a membership row and nothing else about that
-- person's training. The two select policies below are deliberately narrow —
-- scoped to athletes who are members of a club they manage.
-- ============================================================================

alter table memberships
  -- Null means "no end date" — an open-ended membership, and what every
  -- existing row keeps until the club sets a term.
  add column if not exists expires_at date;

create index if not exists memberships_expires_at_idx
  on memberships (club_id, expires_at)
  where expires_at is not null;

-- ----------------------------------------------------------------------------
-- accept_athlete_invitation — start the clock when the member joins
--
-- The term runs from the day they accept, for as long as the plan the club
-- picked says. Without a plan there is no duration to apply, so the
-- membership stays open-ended. Unchanged from 0033 apart from that.
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
  v_duration_days integer;
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
    select duration_days into v_duration_days
    from club_membership_plans
    where id = v_invitation.plan_id;

    insert into memberships (club_id, user_id, role, plan_tier, plan_id, expires_at)
    values (
      v_invitation.club_id,
      v_uid,
      'athlete',
      coalesce(v_invitation.plan_tier, 'basic'::membership_plan_tier),
      v_invitation.plan_id,
      case
        when v_duration_days is not null
          then current_date + v_duration_days
        else null
      end
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

-- ----------------------------------------------------------------------------
-- What a club manager may read about their own members
--
-- is_club_athlete_of_manager(): true when the given user is an athlete
-- member of a club the caller manages. SECURITY DEFINER so the policies
-- below do not recurse through memberships' own policies.
-- ----------------------------------------------------------------------------

create or replace function is_club_athlete_of_manager(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from memberships m
    where m.user_id = target_user_id
      and m.role = 'athlete'
      and has_club_role(m.club_id, array['owner', 'reception']::membership_role[])
  );
$$;

grant execute on function is_club_athlete_of_manager(uuid) to authenticated;

-- Body measurements: the club that registered the member can see the
-- progress recorded for them, the same way their trainer already can.
drop policy if exists "measurements_select_club_managers" on measurements;

create policy "measurements_select_club_managers" on measurements
  for select using (is_club_athlete_of_manager(athlete_id));

-- Assigned plans: club managers see that a member has plans and when they
-- were updated. The existing policy only covered assignments that carry a
-- club_id, which the trainer-side flow does not set.
drop policy if exists "workout_assignments_select_club_managers" on workout_assignments;
drop policy if exists "nutrition_assignments_select_club_managers" on nutrition_assignments;

create policy "workout_assignments_select_club_managers" on workout_assignments
  for select using (
    athlete_id is not null and is_club_athlete_of_manager(athlete_id)
  );

create policy "nutrition_assignments_select_club_managers" on nutrition_assignments
  for select using (
    athlete_id is not null and is_club_athlete_of_manager(athlete_id)
  );
