-- ============================================================================
-- Gymlic — Backfill athletes/plans left incomplete by pre-0007 acceptances
--
-- Before migration 0007, the invite-accept flow was several separate
-- client-side calls, each gated by its own RLS policy, with no atomicity —
-- an athlete could end up with an auth account and an "accepted" invitation
-- while the trainer link, role, or pre-assigned plans never actually landed
-- (whichever step happened to fail partway through). This is a one-time
-- repair pass, idempotent, safe to re-run: it only fills in what's missing.
-- ============================================================================

-- Re-apply the accept side effects for every already-accepted athlete
-- invitation, in case the trainer link / role / name was left unset.
do $$
declare
  r invitations%rowtype;
begin
  for r in
    select * from invitations
    where status = 'accepted'
      and accepted_by is not null
      and invited_role = 'athlete'
      and trainer_id is not null
  loop
    update profiles
    set account_type = coalesce(account_type, 'athlete'),
        first_name = coalesce(first_name, r.first_name),
        last_name = coalesce(last_name, r.last_name)
    where id = r.accepted_by;

    insert into trainer_athletes (trainer_id, athlete_id, club_id)
    values (r.trainer_id, r.accepted_by, r.club_id)
    on conflict (trainer_id, athlete_id) do nothing;

    if r.club_id is not null then
      insert into memberships (club_id, user_id, role)
      values (r.club_id, r.accepted_by, 'athlete')
      on conflict (club_id, user_id) do nothing;
    end if;
  end loop;
end $$;

-- Claim any workout/nutrition plans a trainer assigned to a pending invite
-- that never got transferred to the real athlete_id once accepted.
update workout_assignments wa
set athlete_id = i.accepted_by
from invitations i
where wa.invitation_id = i.id
  and wa.athlete_id is null
  and i.status = 'accepted'
  and i.accepted_by is not null;

update nutrition_assignments na
set athlete_id = i.accepted_by
from invitations i
where na.invitation_id = i.id
  and na.athlete_id is null
  and i.status = 'accepted'
  and i.accepted_by is not null;
