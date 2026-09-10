-- ============================================================================
-- Gymlic — Club profile fields and club-defined membership plans
--
-- Two gaps this closes:
--
-- 1. A club was just a name and a logo column nothing ever wrote. There was
--    nowhere to record the address, phone or working hours a real gym needs
--    on file.
-- 2. Every membership was pinned to one of three hard-coded tiers
--    (elite / basic / daily) baked into the enum and repeated as Persian
--    labels in the client. A club could not name its own plans, price them,
--    or say how long they run — so the plan a member is on carried almost no
--    information.
--
-- club_membership_plans replaces the tiers with rows the club owns. The
-- legacy memberships.plan_tier column stays as it is (still defaulted, still
-- written by nothing new) so anything reading it keeps working while the app
-- moves to plan_id.
-- ============================================================================

alter table clubs
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists working_hours text;

-- ----------------------------------------------------------------------------
-- club_membership_plans — the plans a club sells, in its own words
-- ----------------------------------------------------------------------------

create table if not exists club_membership_plans (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  name text not null,
  price_toman bigint not null default 0 check (price_toman >= 0),
  -- How long one term of this plan runs; drives a membership's expiry date.
  duration_days integer not null default 30 check (duration_days > 0),
  description text,
  -- Retired plans stay for the memberships already on them, but are not
  -- offered when adding a new member.
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists club_membership_plans_club_idx
  on club_membership_plans (club_id, sort_order);

drop trigger if exists club_membership_plans_set_updated_at on club_membership_plans;

create trigger club_membership_plans_set_updated_at
  before update on club_membership_plans
  for each row execute function set_updated_at();

alter table club_membership_plans enable row level security;

-- Every member of the club can read the plans (an athlete's own membership
-- names one); only managers can change them.
drop policy if exists "club_membership_plans_select_members" on club_membership_plans;
drop policy if exists "club_membership_plans_write_managers" on club_membership_plans;

create policy "club_membership_plans_select_members" on club_membership_plans
  for select using (is_club_member(club_id));

create policy "club_membership_plans_write_managers" on club_membership_plans
  for all
  using (has_club_role(club_id, array['owner', 'reception']::membership_role[]))
  with check (has_club_role(club_id, array['owner', 'reception']::membership_role[]));

-- ----------------------------------------------------------------------------
-- memberships / invitations point at a plan
--
-- `on delete set null`: deleting a plan must not delete the people on it —
-- they simply show as having no plan until the club assigns a new one.
-- ----------------------------------------------------------------------------

alter table memberships
  add column if not exists plan_id uuid references club_membership_plans (id) on delete set null;

alter table invitations
  add column if not exists plan_id uuid references club_membership_plans (id) on delete set null;

create index if not exists memberships_plan_idx on memberships (plan_id);

-- ----------------------------------------------------------------------------
-- Backfill: give every existing club the three legacy tiers as real, editable
-- plans, and point existing memberships and pending invites at the matching
-- one. A club that already has plans is left alone, so this is re-runnable.
-- ----------------------------------------------------------------------------

insert into club_membership_plans (club_id, name, duration_days, sort_order)
select c.id, t.label, t.duration, t.sort
from clubs c
cross join (values
  ('ویژه (Elite)', 30, 0),
  ('پایه', 30, 1),
  ('روزانه', 1, 2)
) as t(label, duration, sort)
where not exists (
  select 1 from club_membership_plans p where p.club_id = c.id
);

update memberships m
set plan_id = p.id
from club_membership_plans p
where p.club_id = m.club_id
  and m.plan_id is null
  and p.name = case m.plan_tier
    when 'elite' then 'ویژه (Elite)'
    when 'basic' then 'پایه'
    else 'روزانه'
  end;

update invitations i
set plan_id = p.id
from club_membership_plans p
where i.club_id is not null
  and i.plan_id is null
  and i.plan_tier is not null
  and p.club_id = i.club_id
  and p.name = case i.plan_tier
    when 'elite' then 'ویژه (Elite)'
    when 'basic' then 'پایه'
    else 'روزانه'
  end;

-- ----------------------------------------------------------------------------
-- accept_athlete_invitation — carry the chosen plan onto the membership
--
-- Otherwise a member invited under "پایه" would land with no plan at all now
-- that the app reads plan_id. Unchanged from 0031 apart from that.
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
    insert into memberships (club_id, user_id, role, plan_tier, plan_id)
    values (
      v_invitation.club_id,
      v_uid,
      'athlete',
      coalesce(v_invitation.plan_tier, 'basic'::membership_plan_tier),
      v_invitation.plan_id
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
