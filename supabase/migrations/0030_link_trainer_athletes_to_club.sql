-- ============================================================================
-- Gymlic — Attach a trainer's athletes to the club that trainer works at
--
-- createAthleteInvite never set invitations.club_id, so an athlete invited by
-- a trainer who belongs to a club joined that trainer but never the club: no
-- memberships row, hence an empty member list, a flat plan-distribution chart
-- and no "member joined" notification for the owner. The app now stamps the
-- trainer's club onto new invites; this migration repairs the rows already in
-- the database, idempotently.
--
-- A trainer without a club is untouched everywhere — that case stays exactly
-- as it was. The subquery below resolves the one club each trainer works at:
-- the app model is one club per trainer, and if a trainer somehow holds
-- several active trainer memberships the earliest one wins, matching
-- getTrainerClub()'s ordering. It is repeated rather than kept in a temp
-- object so the script behaves the same whether it runs statement by
-- statement or as one transaction.
-- ============================================================================

-- 1. Invitations already handed out but not yet accepted: stamp the club so
--    accept_athlete_invitation creates the membership when they are used.
update invitations i
set club_id = tc.club_id
from (
  select distinct on (m.user_id) m.user_id as trainer_id, m.club_id
  from memberships m
  where m.role = 'trainer' and m.status = 'active'
  order by m.user_id, m.joined_at
) tc
where i.club_id is null
  and i.trainer_id = tc.trainer_id
  and i.invited_role = 'athlete'
  and i.status = 'pending';

-- 2. The trainer/athlete relation carries the club it happened under.
update trainer_athletes ta
set club_id = tc.club_id
from (
  select distinct on (m.user_id) m.user_id as trainer_id, m.club_id
  from memberships m
  where m.role = 'trainer' and m.status = 'active'
  order by m.user_id, m.joined_at
) tc
where ta.club_id is null
  and ta.trainer_id = tc.trainer_id;

-- 3. The memberships that were never created. The notification trigger is
--    held off for this pass: these athletes joined long ago, and waking the
--    owner with one notification per existing athlete would be noise, not
--    news.
alter table memberships disable trigger memberships_notify_member_joined;

insert into memberships (club_id, user_id, role)
select distinct tc.club_id, ta.athlete_id, 'athlete'::membership_role
from trainer_athletes ta
join (
  select distinct on (m.user_id) m.user_id as trainer_id, m.club_id
  from memberships m
  where m.role = 'trainer' and m.status = 'active'
  order by m.user_id, m.joined_at
) tc on tc.trainer_id = ta.trainer_id
where ta.status = 'active'
on conflict (club_id, user_id) do nothing;

alter table memberships enable trigger memberships_notify_member_joined;
