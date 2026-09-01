-- ============================================================================
-- Gymlic — Club revenue ledger
--
-- revenue_entries has existed since 0002 as the source for the dashboard's
-- "درآمد ماهانه" card and revenue chart, but nothing in the app ever wrote a
-- row: there was no UI, and the table had no insert path a club owner could
-- reach. Both numbers were therefore permanently zero. It also carried no
-- update or delete policy at all, so a mistyped amount could never be fixed.
--
-- This turns it into a ledger a club can actually keep: who paid, what for,
-- a free-text note, and who recorded it — with the corrections that implies.
-- ============================================================================

create type revenue_category as enum (
  'membership',  -- شهریه عضویت
  'session',     -- جلسه یا کلاس تکی
  'product',     -- فروش کالا (مکمل، پوشاک، ...)
  'other'
);

alter table revenue_entries
  -- Nullable with `on delete set null` on purpose: a member deleting their
  -- account must not erase money the club already took in. Income that
  -- belongs to no member (a walk-in product sale) legitimately has none.
  add column if not exists member_id uuid references profiles (id) on delete set null,
  add column if not exists category revenue_category not null default 'membership',
  add column if not exists note text,
  add column if not exists recorded_by uuid references profiles (id),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists revenue_entries_member_idx on revenue_entries (member_id);

drop trigger if exists revenue_entries_set_updated_at on revenue_entries;

create trigger revenue_entries_set_updated_at
  before update on revenue_entries
  for each row execute function set_updated_at();

-- NOT VALID: the rule applies to everything written from now on without
-- forcing a scan of, or a decision about, whatever a database already holds.
alter table revenue_entries
  drop constraint if exists revenue_entries_amount_positive;

alter table revenue_entries
  add constraint revenue_entries_amount_positive check (amount > 0) not valid;

-- 0002 gave the table select and insert policies but neither update nor
-- delete, so a wrong entry was permanent. Managers get both, scoped to
-- their own club exactly like the insert policy.
drop policy if exists "revenue_entries_update_managers" on revenue_entries;
drop policy if exists "revenue_entries_delete_managers" on revenue_entries;

create policy "revenue_entries_update_managers" on revenue_entries
  for update
  using (has_club_role(club_id, array['owner', 'reception']::membership_role[]))
  with check (has_club_role(club_id, array['owner', 'reception']::membership_role[]));

create policy "revenue_entries_delete_managers" on revenue_entries
  for delete using (
    has_club_role(club_id, array['owner', 'reception']::membership_role[])
  );
