-- ============================================================================
-- Gymlic SaaS — Initial Schema
-- Multi-tenant model: Club <-> Trainer <-> Athlete
-- Every business row is scoped by club_id (or a trainer/athlete relation)
-- and every query MUST be filtered accordingly (see RLS policies below).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------

create type account_type as enum ('club', 'trainer', 'athlete');
create type membership_role as enum ('owner', 'trainer', 'reception', 'athlete');
create type membership_status as enum ('active', 'pending', 'suspended');
create type club_status as enum ('active', 'suspended');
create type subscription_status as enum ('active', 'expiring', 'expired');
create type invitation_role as enum ('trainer', 'reception', 'athlete');
create type invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');
create type workout_status as enum ('active', 'completed', 'cancelled');

-- ----------------------------------------------------------------------------
-- profiles — one row per authenticated user (mirrors auth.users)
-- ----------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text unique,
  first_name text,
  last_name text,
  avatar_url text,
  -- Chosen once during "Choose Role" step. Null until the user completes onboarding.
  account_type account_type,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table profiles is 'Application profile for every authenticated user. account_type is the global persona used to pick the Dashboard type (Club / Trainer / Athlete).';

-- ----------------------------------------------------------------------------
-- clubs
-- ----------------------------------------------------------------------------

create table clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  owner_id uuid not null references profiles (id) on delete restrict,
  status club_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clubs_owner_id_idx on clubs (owner_id);

-- ----------------------------------------------------------------------------
-- memberships — links a user to a club with a role inside that club
-- ----------------------------------------------------------------------------

create table memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role membership_role not null,
  status membership_status not null default 'active',
  joined_at timestamptz not null default now(),
  unique (club_id, user_id)
);

create index memberships_club_id_idx on memberships (club_id);
create index memberships_user_id_idx on memberships (user_id);

-- ----------------------------------------------------------------------------
-- trainer_athletes — a Trainer/Athlete relation that can exist without a Club
-- (Business Rule: "A Trainer can use Gymlic without owning a Club" and
--  "An Athlete must belong to at least one Trainer")
-- ----------------------------------------------------------------------------

create table trainer_athletes (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references profiles (id) on delete cascade,
  athlete_id uuid not null references profiles (id) on delete cascade,
  club_id uuid references clubs (id) on delete set null,
  status membership_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (trainer_id, athlete_id)
);

create index trainer_athletes_trainer_idx on trainer_athletes (trainer_id);
create index trainer_athletes_athlete_idx on trainer_athletes (athlete_id);

-- ----------------------------------------------------------------------------
-- invitations — invite codes used by the "Invitation Validation" onboarding step
-- ----------------------------------------------------------------------------

create table invitations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  club_id uuid references clubs (id) on delete cascade,
  trainer_id uuid references profiles (id) on delete cascade,
  invited_role invitation_role not null,
  phone text,
  status invitation_status not null default 'pending',
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_by uuid references profiles (id),
  accepted_at timestamptz
);

create index invitations_code_idx on invitations (code);
create index invitations_club_id_idx on invitations (club_id);

-- ----------------------------------------------------------------------------
-- subscriptions — one active plan per club
-- ----------------------------------------------------------------------------

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  plan_name text not null,
  status subscription_status not null default 'active',
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index subscriptions_club_id_idx on subscriptions (club_id);

-- ----------------------------------------------------------------------------
-- workout_assignments — minimal shape required by the Dashboard statistics
-- (full Workout module is out of scope for this pack)
-- ----------------------------------------------------------------------------

create table workout_assignments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references clubs (id) on delete cascade,
  trainer_id uuid not null references profiles (id) on delete cascade,
  athlete_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  status workout_status not null default 'active',
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workout_assignments_club_idx on workout_assignments (club_id);
create index workout_assignments_trainer_idx on workout_assignments (trainer_id);
create index workout_assignments_athlete_idx on workout_assignments (athlete_id);

-- ----------------------------------------------------------------------------
-- nutrition_assignments — minimal shape required by Trainer/Athlete dashboards
-- ----------------------------------------------------------------------------

create table nutrition_assignments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references clubs (id) on delete cascade,
  trainer_id uuid not null references profiles (id) on delete cascade,
  athlete_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  status workout_status not null default 'active',
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index nutrition_assignments_club_idx on nutrition_assignments (club_id);
create index nutrition_assignments_trainer_idx on nutrition_assignments (trainer_id);
create index nutrition_assignments_athlete_idx on nutrition_assignments (athlete_id);

-- ----------------------------------------------------------------------------
-- measurements — athlete body measurements (height/weight/etc history)
-- ----------------------------------------------------------------------------

create table measurements (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references profiles (id) on delete cascade,
  recorded_by uuid references profiles (id),
  height_cm numeric(5, 1),
  weight_kg numeric(5, 1),
  body_fat_percent numeric(4, 1),
  note text,
  recorded_at timestamptz not null default now()
);

create index measurements_athlete_idx on measurements (athlete_id, recorded_at desc);

-- ----------------------------------------------------------------------------
-- activity_logs — feeds the Recent Activity widget
-- ----------------------------------------------------------------------------

create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references clubs (id) on delete cascade,
  actor_id uuid references profiles (id),
  subject_id uuid references profiles (id),
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_logs_club_idx on activity_logs (club_id, created_at desc);

-- ----------------------------------------------------------------------------
-- updated_at triggers
-- ----------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();

create trigger clubs_set_updated_at before update on clubs
  for each row execute function set_updated_at();

create trigger workout_assignments_set_updated_at before update on workout_assignments
  for each row execute function set_updated_at();

create trigger nutrition_assignments_set_updated_at before update on nutrition_assignments
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Helper functions used by RLS policies
-- ----------------------------------------------------------------------------

-- Is the current user an active member of the given club?
create or replace function is_club_member(target_club_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from memberships
    where club_id = target_club_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

-- Does the current user hold one of the given roles inside the club?
create or replace function has_club_role(target_club_id uuid, roles membership_role[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from memberships
    where club_id = target_club_id
      and user_id = auth.uid()
      and status = 'active'
      and role = any (roles)
  );
$$;

-- Is the current user the trainer (or the athlete) in this trainer/athlete pair?
create or replace function is_trainer_of(target_athlete_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from trainer_athletes
    where athlete_id = target_athlete_id
      and trainer_id = auth.uid()
      and status = 'active'
  );
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

alter table profiles enable row level security;
alter table clubs enable row level security;
alter table memberships enable row level security;
alter table trainer_athletes enable row level security;
alter table invitations enable row level security;
alter table subscriptions enable row level security;
alter table workout_assignments enable row level security;
alter table nutrition_assignments enable row level security;
alter table measurements enable row level security;
alter table activity_logs enable row level security;

-- profiles: everyone can read their own profile, plus the profiles of people
-- they share a club or a trainer/athlete relation with.
create policy "profiles_select_self" on profiles
  for select using (id = auth.uid());

create policy "profiles_select_club_peers" on profiles
  for select using (
    exists (
      select 1 from memberships m1
      join memberships m2 on m1.club_id = m2.club_id
      where m1.user_id = auth.uid()
        and m2.user_id = profiles.id
        and m1.status = 'active'
        and m2.status = 'active'
    )
  );

create policy "profiles_select_trainer_athlete" on profiles
  for select using (
    exists (
      select 1 from trainer_athletes
      where status = 'active'
        and ((trainer_id = auth.uid() and athlete_id = profiles.id)
          or (athlete_id = auth.uid() and trainer_id = profiles.id))
    )
  );

create policy "profiles_update_self" on profiles
  for update using (id = auth.uid());

create policy "profiles_insert_self" on profiles
  for insert with check (id = auth.uid());

-- clubs: members can read; only the owner can update.
create policy "clubs_select_members" on clubs
  for select using (is_club_member(id) or owner_id = auth.uid());

create policy "clubs_insert_owner" on clubs
  for insert with check (owner_id = auth.uid());

create policy "clubs_update_owner" on clubs
  for update using (owner_id = auth.uid());

-- memberships: a user can see their own memberships, and owners/reception can
-- see every membership inside their club.
create policy "memberships_select_self" on memberships
  for select using (user_id = auth.uid());

create policy "memberships_select_club_managers" on memberships
  for select using (has_club_role(club_id, array['owner', 'reception']::membership_role[]));

create policy "memberships_insert_owner" on memberships
  for insert with check (has_club_role(club_id, array['owner']::membership_role[]) or user_id = auth.uid());

create policy "memberships_update_owner" on memberships
  for update using (has_club_role(club_id, array['owner']::membership_role[]));

-- trainer_athletes: visible to the trainer and the athlete involved.
create policy "trainer_athletes_select" on trainer_athletes
  for select using (trainer_id = auth.uid() or athlete_id = auth.uid());

create policy "trainer_athletes_insert" on trainer_athletes
  for insert with check (trainer_id = auth.uid() or athlete_id = auth.uid());

-- invitations: visible to their creator, or resolvable by anyone with the code
-- via a security-definer RPC (kept simple here: creator + club managers).
create policy "invitations_select_creator" on invitations
  for select using (
    created_by = auth.uid()
    or (club_id is not null and has_club_role(club_id, array['owner', 'reception']::membership_role[]))
  );

create policy "invitations_insert_creator" on invitations
  for insert with check (created_by = auth.uid());

create policy "invitations_update_creator" on invitations
  for update using (
    created_by = auth.uid()
    or (club_id is not null and has_club_role(club_id, array['owner', 'reception']::membership_role[]))
  );

-- subscriptions: club members can read; only the owner can write.
create policy "subscriptions_select_members" on subscriptions
  for select using (is_club_member(club_id));

create policy "subscriptions_insert_owner" on subscriptions
  for insert with check (has_club_role(club_id, array['owner']::membership_role[]));

create policy "subscriptions_update_owner" on subscriptions
  for update using (has_club_role(club_id, array['owner']::membership_role[]));

-- workout_assignments: visible to the trainer, the athlete, and club managers.
create policy "workout_assignments_select" on workout_assignments
  for select using (
    trainer_id = auth.uid()
    or athlete_id = auth.uid()
    or (club_id is not null and has_club_role(club_id, array['owner', 'reception']::membership_role[]))
  );

create policy "workout_assignments_write" on workout_assignments
  for all using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

-- nutrition_assignments: same rule shape as workout_assignments.
create policy "nutrition_assignments_select" on nutrition_assignments
  for select using (
    trainer_id = auth.uid()
    or athlete_id = auth.uid()
    or (club_id is not null and has_club_role(club_id, array['owner', 'reception']::membership_role[]))
  );

create policy "nutrition_assignments_write" on nutrition_assignments
  for all using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

-- measurements: visible to the athlete and their trainer(s).
create policy "measurements_select" on measurements
  for select using (athlete_id = auth.uid() or is_trainer_of(athlete_id));

create policy "measurements_write" on measurements
  for insert with check (athlete_id = auth.uid() or is_trainer_of(athlete_id));

-- activity_logs: visible to club managers and the actor/subject involved.
create policy "activity_logs_select" on activity_logs
  for select using (
    actor_id = auth.uid()
    or subject_id = auth.uid()
    or (club_id is not null and is_club_member(club_id))
  );

create policy "activity_logs_insert" on activity_logs
  for insert with check (actor_id = auth.uid());
