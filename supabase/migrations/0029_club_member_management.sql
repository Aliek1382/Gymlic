-- ============================================================================
-- Gymlic — Club-side member management
--
-- Until now a club had no way at all to gain members: the only invitation the
-- app ever created was trainer-scoped (`invited_role = 'athlete'`, `club_id`
-- null), so `memberships` rows with role 'athlete' were never written and the
-- club panel's member list, plan distribution and "member joined" notification
-- were permanently empty.
--
-- This adds the missing club-owned path:
--   * invitations can carry the plan tier the club assigned up front,
--   * accept_athlete_invitation now also accepts an invite created by a club
--     (no trainer attached), and optionally links the athlete to one of the
--     club's trainers when the club picked one,
--   * a club owner can finally remove a membership (there was no delete
--     policy on `memberships` at all).
-- ============================================================================

-- The tier the club chose when inviting; null falls back to the memberships
-- default ('basic') on accept.
alter table invitations
  add column if not exists plan_tier membership_plan_tier;

-- ----------------------------------------------------------------------------
-- accept_athlete_invitation — now covers both invite origins
--
-- Trainer-created: trainer_id set, club_id usually null.
-- Club-created:    club_id set, trainer_id optional (the club may pre-assign
--                  one of its own trainers).
-- ----------------------------------------------------------------------------

create or replace function accept_athlete_invitation(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation invitations%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'نشست کاربر معتبر نیست.';
  end if;

  select * into v_invitation
  from invitations
  where code = p_code and status = 'pending' and expires_at > now()
  for update;

  -- An invite with neither a trainer nor a club has nothing to attach the
  -- athlete to, and this RPC only completes athlete invites (trainer and
  -- reception invites go through acceptInvitation on the client).
  if not found
    or v_invitation.invited_role <> 'athlete'
    or (v_invitation.trainer_id is null and v_invitation.club_id is null)
  then
    raise exception 'این لینک دعوت معتبر نیست یا منقضی شده است.';
  end if;

  update profiles
  set account_type = 'athlete',
      first_name = coalesce(v_invitation.first_name, first_name),
      last_name = coalesce(v_invitation.last_name, last_name)
  where id = v_uid;

  -- profiles.phone is unique, so the number the club typed is only copied
  -- over when this profile has none and no other account already claims it.
  -- Otherwise it simply stays on the invitation row.
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

-- ----------------------------------------------------------------------------
-- memberships: the owner can now remove a member
--
-- 0001 gave memberships select/insert/update policies but no delete one, so
-- "remove member" was impossible. The owner's own row is excluded — deleting
-- it would lock them out of their own club.
-- ----------------------------------------------------------------------------

drop policy if exists "memberships_delete_owner" on memberships;

create policy "memberships_delete_owner" on memberships
  for delete using (
    has_club_role(club_id, array['owner']::membership_role[])
    and user_id <> auth.uid()
  );

-- ----------------------------------------------------------------------------
-- get_invitation_preview — also tell the /join page who is inviting
--
-- The page's copy used to be hard-coded to "your trainer invited you", which
-- is wrong for a club-created invite. Returning the club name lets the page
-- name the actual inviter. Return type changes are not allowed by CREATE OR
-- REPLACE, hence the drop.
-- ----------------------------------------------------------------------------

drop function if exists get_invitation_preview(text);

create or replace function get_invitation_preview(p_code text)
returns table (first_name text, last_name text, club_name text)
language sql
security definer
set search_path = public
stable
as $$
  select i.first_name, i.last_name, c.name
  from invitations i
  left join clubs c on c.id = i.club_id
  where i.code = p_code and i.status = 'pending' and i.expires_at > now();
$$;

grant execute on function get_invitation_preview(text) to anon, authenticated;
