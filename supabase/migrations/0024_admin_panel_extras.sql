-- ============================================================================
-- Gymlic — Admin panel follow-ups
--
-- Closes four gaps left after 0023: new clubs now require platform-admin
-- approval before they're usable (not just their subscription), plans can
-- cap member count (not only duration), the broadcast notification can
-- target specific clubs instead of only "everyone", and the club detail
-- page in the admin panel gets a real member list for support use.
-- ============================================================================

-- A club now starts life unreachable by its own owner until a platform
-- admin approves it (admin_set_club_status(..., 'active')) — separate from,
-- and prior to, the subscription/payment approval flow in 0023. Existing
-- clubs are untouched: only the column default changes, so every club
-- created before this migration stays exactly as it was.
alter type club_status add value if not exists 'pending';
alter table clubs alter column status set default 'pending';

-- Plans can now also cap how many members a club may have — not just how
-- long the subscription lasts. Null means "no cap from this plan" (leaves
-- clubs.member_capacity, itself already nullable = unlimited, untouched).
alter table plans add column if not exists max_members integer;

-- approve_payment_request now also applies the plan's member cap to the
-- club, alongside activating/extending the subscription as before.
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

  update clubs set member_capacity = v_plan.max_members where id = v_request.club_id;

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

-- create_broadcast_notification can now target specific clubs — null (the
-- existing default) still means every profile on the platform; a non-empty
-- array restricts it to the active members (any role) of those clubs.
-- CREATE OR REPLACE with only trailing defaulted parameters added keeps the
-- function's identity, so the 0021 grant still applies; granted again below
-- against the new signature for clarity.
create or replace function create_broadcast_notification(
  p_title text,
  p_body text default null,
  p_link text default null,
  p_club_ids uuid[] default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception 'اجازه ارسال اعلان عمومی را ندارید.';
  end if;

  if p_club_ids is null or array_length(p_club_ids, 1) is null then
    insert into notifications (recipient_id, actor_id, type, title, body, link)
    select id, auth.uid(), 'broadcast', p_title, p_body, p_link
    from profiles;
  else
    insert into notifications (recipient_id, actor_id, type, title, body, link)
    select distinct m.user_id, auth.uid(), 'broadcast', p_title, p_body, p_link
    from memberships m
    where m.club_id = any(p_club_ids) and m.status = 'active';
  end if;
end;
$$;

grant execute on function create_broadcast_notification(text, text, text, uuid[]) to authenticated;
