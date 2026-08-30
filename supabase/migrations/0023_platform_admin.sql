-- ============================================================================
-- Gymlic — Platform admin panel
--
-- Adds a super-admin surface (gated by profiles.is_platform_admin, already
-- introduced in 0021) that sits above the per-club RLS model: a platform
-- admin can see every club/trainer/athlete and drive the club subscription
-- lifecycle, independent of which club(s) they happen to belong to.
--
-- Payment flow: a club owner submits a payment_requests row claiming they
-- paid for a plan (offline transfer — there is no payment gateway yet); a
-- platform admin reviews and approves/rejects it. Approval is the only way
-- a subscriptions row gets created/extended — club owners can no longer
-- write it directly (see the dropped policies below), closing the gap where
-- an owner could previously self-activate their own subscription.
-- ============================================================================

alter table profiles add column if not exists is_suspended boolean not null default false;

create type payment_request_status as enum ('pending', 'approved', 'rejected');

-- Is the current user a platform admin?
create or replace function is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and is_platform_admin
  );
$$;

-- ----------------------------------------------------------------------------
-- plans — official catalog of subscription plans clubs can be billed on.
-- ----------------------------------------------------------------------------

create table plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_toman bigint not null check (price_toman >= 0),
  duration_days integer not null check (duration_days > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger plans_set_updated_at
  before update on plans
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- payment_requests — a club owner's claim of an offline payment, awaiting
-- platform-admin review.
-- ----------------------------------------------------------------------------

create table payment_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  plan_id uuid not null references plans (id),
  submitted_by uuid not null references profiles (id),
  amount_toman bigint not null check (amount_toman >= 0),
  reference_note text,
  status payment_request_status not null default 'pending',
  admin_note text,
  reviewed_by uuid references profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index payment_requests_club_idx on payment_requests (club_id, created_at desc);
create index payment_requests_status_idx on payment_requests (status);

alter table plans enable row level security;
alter table payment_requests enable row level security;

-- plans: every authenticated user can read the active catalog (needed to
-- submit a payment request); only a platform admin can manage it.
create policy "plans_select_all" on plans
  for select using (auth.uid() is not null);

create policy "plans_write_admin" on plans
  for all using (is_platform_admin()) with check (is_platform_admin());

-- payment_requests: a club owner can see and file requests for their own
-- club; a platform admin can see and review every request. Status/review
-- fields only ever change through the RPCs below (security definer), so
-- there is no owner update policy — an owner cannot mark their own request
-- approved.
create policy "payment_requests_select_owner" on payment_requests
  for select using (has_club_role(club_id, array['owner']::membership_role[]));

create policy "payment_requests_select_admin" on payment_requests
  for select using (is_platform_admin());

create policy "payment_requests_insert_owner" on payment_requests
  for insert with check (has_club_role(club_id, array['owner']::membership_role[]) and submitted_by = auth.uid());

-- ----------------------------------------------------------------------------
-- subscriptions — close the self-activation gap: an owner could previously
-- insert/update this table directly and set status = 'active' without ever
-- paying. Now only a platform admin (via approve_payment_request) can write
-- it; members keep read access.
-- ----------------------------------------------------------------------------

drop policy if exists "subscriptions_insert_owner" on subscriptions;
drop policy if exists "subscriptions_update_owner" on subscriptions;

create policy "subscriptions_write_admin" on subscriptions
  for all using (is_platform_admin()) with check (is_platform_admin());

-- ----------------------------------------------------------------------------
-- Platform-wide read access for admin list/detail pages, and the ability to
-- suspend/activate a club.
-- ----------------------------------------------------------------------------

create policy "clubs_select_admin" on clubs
  for select using (is_platform_admin());

create policy "clubs_update_admin" on clubs
  for update using (is_platform_admin()) with check (is_platform_admin());

create policy "profiles_select_admin" on profiles
  for select using (is_platform_admin());

create policy "memberships_select_admin" on memberships
  for select using (is_platform_admin());

create policy "trainer_athletes_select_admin" on trainer_athletes
  for select using (is_platform_admin());

create policy "activity_logs_select_admin" on activity_logs
  for select using (is_platform_admin());

-- ----------------------------------------------------------------------------
-- RPCs — every write a platform admin makes goes through one of these, so
-- the audit trail (activity_logs) and the state transitions stay consistent
-- instead of being reconstructed ad hoc from raw table writes.
-- ----------------------------------------------------------------------------

-- A club owner files a claim of an offline payment for a plan.
create or replace function submit_payment_request(
  p_plan_id uuid,
  p_amount_toman bigint,
  p_reference_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
  v_request_id uuid;
begin
  select club_id into v_club_id
  from memberships
  where user_id = auth.uid() and role = 'owner' and status = 'active'
  limit 1;

  if v_club_id is null then
    raise exception 'شما مالک هیچ باشگاهی نیستید.';
  end if;

  if not exists (select 1 from plans where id = p_plan_id and is_active) then
    raise exception 'پلن انتخاب‌شده معتبر نیست.';
  end if;

  insert into payment_requests (club_id, plan_id, submitted_by, amount_toman, reference_note)
  values (v_club_id, p_plan_id, auth.uid(), p_amount_toman, p_reference_note)
  returning id into v_request_id;

  return v_request_id;
end;
$$;

grant execute on function submit_payment_request(uuid, bigint, text) to authenticated;

-- Platform admin approves a pending request: activates/extends the club's
-- subscription and logs the action.
create or replace function approve_payment_request(
  p_request_id uuid,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request payment_requests%rowtype;
  v_plan plans%rowtype;
begin
  if not is_platform_admin() then
    raise exception 'اجازه این عملیات را ندارید.';
  end if;

  select * into v_request from payment_requests where id = p_request_id for update;
  if v_request.id is null then
    raise exception 'درخواست پیدا نشد.';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'این درخواست قبلاً بررسی شده است.';
  end if;

  select * into v_plan from plans where id = v_request.plan_id;

  if exists (select 1 from subscriptions where club_id = v_request.club_id) then
    update subscriptions
    set plan_name = v_plan.name,
        status = 'active',
        started_at = now(),
        expires_at = now() + make_interval(days => v_plan.duration_days)
    where club_id = v_request.club_id;
  else
    insert into subscriptions (club_id, plan_name, status, started_at, expires_at)
    values (v_request.club_id, v_plan.name, 'active', now(), now() + make_interval(days => v_plan.duration_days));
  end if;

  update payment_requests
  set status = 'approved',
      admin_note = p_admin_note,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_request_id;

  insert into activity_logs (club_id, actor_id, subject_id, action, metadata)
  values (
    v_request.club_id,
    auth.uid(),
    v_request.submitted_by,
    'subscription_activated',
    jsonb_build_object('plan_name', v_plan.name, 'amount_toman', v_request.amount_toman)
  );
end;
$$;

grant execute on function approve_payment_request(uuid, text) to authenticated;

-- Platform admin rejects a pending request.
create or replace function reject_payment_request(
  p_request_id uuid,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request payment_requests%rowtype;
begin
  if not is_platform_admin() then
    raise exception 'اجازه این عملیات را ندارید.';
  end if;

  select * into v_request from payment_requests where id = p_request_id for update;
  if v_request.id is null then
    raise exception 'درخواست پیدا نشد.';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'این درخواست قبلاً بررسی شده است.';
  end if;

  update payment_requests
  set status = 'rejected',
      admin_note = p_admin_note,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_request_id;

  insert into activity_logs (club_id, actor_id, subject_id, action, metadata)
  values (v_request.club_id, auth.uid(), v_request.submitted_by, 'payment_request_rejected', jsonb_build_object('admin_note', p_admin_note));
end;
$$;

grant execute on function reject_payment_request(uuid, text) to authenticated;

-- Platform admin suspends/activates a club.
create or replace function admin_set_club_status(p_club_id uuid, p_status club_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception 'اجازه این عملیات را ندارید.';
  end if;

  update clubs set status = p_status where id = p_club_id;

  insert into activity_logs (club_id, actor_id, action, metadata)
  values (p_club_id, auth.uid(), 'club_status_changed', jsonb_build_object('status', p_status));
end;
$$;

grant execute on function admin_set_club_status(uuid, club_status) to authenticated;

-- Platform admin suspends/reinstates any account (trainer, athlete, or club
-- owner). Enforcement is at the app layer (the dashboard layout blocks a
-- suspended profile), not deeper RLS, matching how every other redirect
-- rule in this app is enforced.
create or replace function admin_set_profile_suspended(p_user_id uuid, p_suspended boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception 'اجازه این عملیات را ندارید.';
  end if;

  update profiles set is_suspended = p_suspended where id = p_user_id;

  insert into activity_logs (actor_id, subject_id, action, metadata)
  values (auth.uid(), p_user_id, 'profile_suspended_changed', jsonb_build_object('is_suspended', p_suspended));
end;
$$;

grant execute on function admin_set_profile_suspended(uuid, boolean) to authenticated;

-- Platform admin edits the handful of self-reported profile fields — never
-- account_type or is_platform_admin, both out of scope for this RPC on
-- purpose so a compromised admin session can't self-escalate other accounts.
create or replace function admin_update_profile(
  p_user_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_birth_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception 'اجازه این عملیات را ندارید.';
  end if;

  update profiles
  set first_name = p_first_name,
      last_name = p_last_name,
      email = p_email,
      phone = p_phone,
      birth_date = p_birth_date
  where id = p_user_id;

  insert into activity_logs (actor_id, subject_id, action, metadata)
  values (auth.uid(), p_user_id, 'profile_edited_by_admin', '{}'::jsonb);
end;
$$;

grant execute on function admin_update_profile(uuid, text, text, text, text, date) to authenticated;
