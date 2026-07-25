-- ============================================================================
-- Gymlic — Robust invite-accept flow + plans pre-assigned to a pending athlete
--
-- The previous approach accepted an invitation via several separate
-- client-side calls, each gated by its own RLS policy — the accept step's
-- UPDATE could fail RLS depending on policy combination, and a partial
-- failure left the athlete half set-up with no way to retry cleanly. This
-- replaces it with two SECURITY DEFINER functions that do their work
-- atomically and aren't at the mercy of client-facing RLS policies at all.
--
-- It also lets a trainer assign workout/nutrition plans to an athlete who
-- has only been invited (not yet joined) by pointing the assignment at the
-- invitation instead of a not-yet-existing athlete_id; accept_athlete_invitation
-- claims those rows for the real athlete_id once the athlete joins.
-- ============================================================================

drop policy if exists "invitations_select_public_pending" on invitations;
drop policy if exists "invitations_update_accept" on invitations;

alter table workout_assignments
  alter column athlete_id drop not null,
  add column invitation_id uuid references invitations (id) on delete cascade;

alter table nutrition_assignments
  alter column athlete_id drop not null,
  add column invitation_id uuid references invitations (id) on delete cascade;

alter table workout_assignments
  add constraint workout_assignments_target_chk
  check (athlete_id is not null or invitation_id is not null);

alter table nutrition_assignments
  add constraint nutrition_assignments_target_chk
  check (athlete_id is not null or invitation_id is not null);

create index workout_assignments_invitation_idx on workout_assignments (invitation_id);
create index nutrition_assignments_invitation_idx on nutrition_assignments (invitation_id);

-- Public, column-limited preview for the unauthenticated /join/[code] page —
-- narrower than the row-level policy it replaces (no trainer_id/phone/etc
-- ever leaves the database for an anonymous visitor).
create or replace function get_invitation_preview(p_code text)
returns table (first_name text, last_name text)
language sql
security definer
set search_path = public
stable
as $$
  select first_name, last_name
  from invitations
  where code = p_code and status = 'pending' and expires_at > now();
$$;

grant execute on function get_invitation_preview(text) to anon, authenticated;

-- Completes a trainer-generated athlete invite for the now-authenticated
-- user: sets their role/name, links them to the inviting trainer, carries
-- over any measurements, claims any plans the trainer already assigned
-- while the athlete was still pending, and marks the invitation accepted.
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

  if not found or v_invitation.trainer_id is null then
    raise exception 'این لینک دعوت معتبر نیست یا منقضی شده است.';
  end if;

  update profiles
  set account_type = 'athlete',
      first_name = v_invitation.first_name,
      last_name = v_invitation.last_name
  where id = v_uid;

  insert into trainer_athletes (trainer_id, athlete_id, club_id)
  values (v_invitation.trainer_id, v_uid, v_invitation.club_id)
  on conflict (trainer_id, athlete_id) do nothing;

  if v_invitation.club_id is not null then
    insert into memberships (club_id, user_id, role)
    values (v_invitation.club_id, v_uid, 'athlete')
    on conflict (club_id, user_id) do nothing;
  end if;

  if v_invitation.height_cm is not null or v_invitation.weight_kg is not null then
    insert into measurements (athlete_id, recorded_by, height_cm, weight_kg)
    values (v_uid, v_invitation.trainer_id, v_invitation.height_cm, v_invitation.weight_kg);
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
