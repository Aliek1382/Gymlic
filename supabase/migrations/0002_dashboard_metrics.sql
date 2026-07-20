-- ============================================================================
-- Gymlic — Dashboard supporting metrics
-- Small, additive columns/tables needed so the Club Dashboard (attendance %,
-- monthly revenue, membership plan distribution) can be backed by real data
-- instead of mock numbers, without owning the future Membership/Payments
-- modules outright.
-- ============================================================================

create type membership_plan_tier as enum ('elite', 'basic', 'daily');

alter table memberships
  add column plan_tier membership_plan_tier not null default 'basic';

alter table clubs
  add column member_capacity integer;

-- ----------------------------------------------------------------------------
-- revenue_entries — recognized income entries feeding the "درآمد ماهانه" card
-- ----------------------------------------------------------------------------

create table revenue_entries (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  amount numeric(14, 0) not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index revenue_entries_club_idx on revenue_entries (club_id, occurred_at desc);

alter table revenue_entries enable row level security;

create policy "revenue_entries_select_members" on revenue_entries
  for select using (is_club_member(club_id));

create policy "revenue_entries_write_managers" on revenue_entries
  for insert with check (has_club_role(club_id, array['owner', 'reception']::membership_role[]));

-- ----------------------------------------------------------------------------
-- class_attendance_logs — feeds the "حضور در کلاس" card
-- ----------------------------------------------------------------------------

create table class_attendance_logs (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  member_id uuid not null references profiles (id) on delete cascade,
  attended boolean not null default true,
  class_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index class_attendance_logs_club_idx on class_attendance_logs (club_id, class_date desc);

alter table class_attendance_logs enable row level security;

create policy "class_attendance_logs_select_members" on class_attendance_logs
  for select using (is_club_member(club_id));

create policy "class_attendance_logs_write_managers" on class_attendance_logs
  for insert with check (has_club_role(club_id, array['owner', 'reception', 'trainer']::membership_role[]));
