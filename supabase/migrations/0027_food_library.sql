-- ============================================================================
-- Gymlic — Food Library
--
-- The nutrition-plan counterpart of the exercise library: a shared bank of
-- foods a trainer can pick from when writing a nutrition plan. Rows with
-- created_by = null are Gymlic's built-in presets (visible to every
-- trainer); rows with created_by set are a trainer's own custom foods,
-- visible only to them.
--
-- No calories/macros yet — this phase only covers picking a food, an
-- amount and a unit.
-- ============================================================================

create table foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_en text,
  description text,
  category text not null,
  default_unit text not null,
  created_by uuid references profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index foods_created_by_idx on foods (created_by);

alter table foods enable row level security;

create policy "foods_select" on foods
  for select using (created_by is null or created_by = auth.uid());

create policy "foods_insert_own" on foods
  for insert with check (created_by = auth.uid());

-- ----------------------------------------------------------------------------
-- Per-trainer usage tracking, powering the "most used first" ordering in the
-- food picker — same shape as exercise_usage.
-- ----------------------------------------------------------------------------

create table food_usage (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references profiles (id) on delete cascade,
  food_id uuid not null references foods (id) on delete cascade,
  use_count integer not null default 0,
  last_used_at timestamptz not null default now(),
  unique (trainer_id, food_id)
);

create index food_usage_trainer_idx on food_usage (trainer_id);

alter table food_usage enable row level security;

create policy "food_usage_select_own" on food_usage
  for select using (trainer_id = auth.uid());

create policy "food_usage_insert_own" on food_usage
  for insert with check (trainer_id = auth.uid());

create policy "food_usage_update_own" on food_usage
  for update using (trainer_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Preset foods (created_by = null) — everyday Iranian staples filtered down
-- to what an athlete's plan actually draws on, grouped by category.
-- ----------------------------------------------------------------------------

insert into foods (name, name_en, category, default_unit) values
  -- منابع پروتئینی
  ('سینه مرغ', 'Chicken Breast', 'منابع پروتئینی', 'گرم'),
  ('ران مرغ بدون پوست', 'Skinless Chicken Thigh', 'منابع پروتئینی', 'گرم'),
  ('گوشت گوساله کم‌چرب', 'Lean Beef', 'منابع پروتئینی', 'گرم'),
  ('گوشت گوسفند کم‌چرب', 'Lean Lamb', 'منابع پروتئینی', 'گرم'),
  ('ماهی قزل‌آلا', 'Trout', 'منابع پروتئینی', 'گرم'),
  ('ماهی سالمون', 'Salmon', 'منابع پروتئینی', 'گرم'),
  ('تن ماهی در آب', 'Canned Tuna in Water', 'منابع پروتئینی', 'گرم'),
  ('میگو', 'Shrimp', 'منابع پروتئینی', 'گرم'),
  ('تخم‌مرغ کامل', 'Whole Egg', 'منابع پروتئینی', 'عدد'),
  ('سفیده تخم‌مرغ', 'Egg White', 'منابع پروتئینی', 'عدد'),
  ('بوقلمون', 'Turkey Breast', 'منابع پروتئینی', 'گرم'),
  -- کربوهیدرات و غلات
  ('برنج سفید پخته', 'Cooked White Rice', 'کربوهیدرات و غلات', 'گرم'),
  ('برنج قهوه‌ای پخته', 'Cooked Brown Rice', 'کربوهیدرات و غلات', 'گرم'),
  ('جو دوسر (اُتمیل)', 'Rolled Oats', 'کربوهیدرات و غلات', 'گرم'),
  ('نان سنگک', 'Sangak Bread', 'کربوهیدرات و غلات', 'برش'),
  ('نان بربری', 'Barbari Bread', 'کربوهیدرات و غلات', 'برش'),
  ('نان جو', 'Barley Bread', 'کربوهیدرات و غلات', 'برش'),
  ('ماکارونی پخته', 'Cooked Pasta', 'کربوهیدرات و غلات', 'گرم'),
  ('سیب‌زمینی آب‌پز', 'Boiled Potato', 'کربوهیدرات و غلات', 'گرم'),
  ('سیب‌زمینی شیرین', 'Sweet Potato', 'کربوهیدرات و غلات', 'گرم'),
  ('کینوا پخته', 'Cooked Quinoa', 'کربوهیدرات و غلات', 'گرم'),
  ('ذرت پخته', 'Cooked Corn', 'کربوهیدرات و غلات', 'گرم'),
  -- حبوبات
  ('عدس پخته', 'Cooked Lentils', 'حبوبات', 'گرم'),
  ('لپه پخته', 'Cooked Split Peas', 'حبوبات', 'گرم'),
  ('نخود پخته', 'Cooked Chickpeas', 'حبوبات', 'گرم'),
  ('لوبیا قرمز پخته', 'Cooked Red Beans', 'حبوبات', 'گرم'),
  ('لوبیا چیتی پخته', 'Cooked Pinto Beans', 'حبوبات', 'گرم'),
  ('سویا', 'Soy Chunks', 'حبوبات', 'گرم'),
  -- لبنیات
  ('شیر کم‌چرب', 'Low-Fat Milk', 'لبنیات', 'لیوان'),
  ('ماست کم‌چرب', 'Low-Fat Yogurt', 'لبنیات', 'گرم'),
  ('ماست یونانی', 'Greek Yogurt', 'لبنیات', 'گرم'),
  ('پنیر کم‌چرب', 'Low-Fat Cheese', 'لبنیات', 'گرم'),
  ('کشک', 'Kashk', 'لبنیات', 'قاشق غذاخوری'),
  ('دوغ بدون گاز', 'Doogh', 'لبنیات', 'لیوان'),
  ('شیر سویا', 'Soy Milk', 'لبنیات', 'لیوان'),
  -- سبزیجات
  ('کاهو', 'Lettuce', 'سبزیجات', 'گرم'),
  ('گوجه‌فرنگی', 'Tomato', 'سبزیجات', 'عدد'),
  ('خیار', 'Cucumber', 'سبزیجات', 'عدد'),
  ('کلم بروکلی', 'Broccoli', 'سبزیجات', 'گرم'),
  ('اسفناج', 'Spinach', 'سبزیجات', 'گرم'),
  ('هویج', 'Carrot', 'سبزیجات', 'عدد'),
  ('کدو سبز', 'Zucchini', 'سبزیجات', 'گرم'),
  ('فلفل دلمه‌ای', 'Bell Pepper', 'سبزیجات', 'عدد'),
  ('پیاز', 'Onion', 'سبزیجات', 'عدد'),
  ('سبزی خوردن', 'Fresh Herbs', 'سبزیجات', 'مشت'),
  -- میوه‌ها
  ('موز', 'Banana', 'میوه‌ها', 'عدد'),
  ('سیب', 'Apple', 'میوه‌ها', 'عدد'),
  ('پرتقال', 'Orange', 'میوه‌ها', 'عدد'),
  ('خرما', 'Date', 'میوه‌ها', 'عدد'),
  ('انگور', 'Grapes', 'میوه‌ها', 'گرم'),
  ('توت‌فرنگی', 'Strawberry', 'میوه‌ها', 'گرم'),
  ('کیوی', 'Kiwi', 'میوه‌ها', 'عدد'),
  ('هندوانه', 'Watermelon', 'میوه‌ها', 'گرم'),
  ('آناناس', 'Pineapple', 'میوه‌ها', 'گرم'),
  -- چربی‌های سالم
  ('بادام', 'Almonds', 'چربی‌های سالم', 'گرم'),
  ('گردو', 'Walnuts', 'چربی‌های سالم', 'گرم'),
  ('پسته', 'Pistachios', 'چربی‌های سالم', 'گرم'),
  ('بادام‌زمینی', 'Peanuts', 'چربی‌های سالم', 'گرم'),
  ('کره بادام‌زمینی', 'Peanut Butter', 'چربی‌های سالم', 'قاشق غذاخوری'),
  ('روغن زیتون', 'Olive Oil', 'چربی‌های سالم', 'قاشق غذاخوری'),
  ('آووکادو', 'Avocado', 'چربی‌های سالم', 'عدد'),
  ('تخم چیا', 'Chia Seeds', 'چربی‌های سالم', 'قاشق غذاخوری'),
  ('تخمه کدو', 'Pumpkin Seeds', 'چربی‌های سالم', 'گرم'),
  -- مکمل‌ها
  ('پودر پروتئین وی', 'Whey Protein Powder', 'مکمل‌ها', 'اسکوپ'),
  ('کراتین مونوهیدرات', 'Creatine Monohydrate', 'مکمل‌ها', 'گرم'),
  ('گینر', 'Mass Gainer', 'مکمل‌ها', 'اسکوپ'),
  ('مولتی‌ویتامین', 'Multivitamin', 'مکمل‌ها', 'عدد'),
  ('امگا ۳', 'Omega-3', 'مکمل‌ها', 'عدد'),
  -- نوشیدنی‌ها
  ('آب', 'Water', 'نوشیدنی‌ها', 'لیوان'),
  ('چای سبز', 'Green Tea', 'نوشیدنی‌ها', 'لیوان'),
  ('قهوه تلخ', 'Black Coffee', 'نوشیدنی‌ها', 'فنجان'),
  ('آب‌میوه طبیعی', 'Fresh Fruit Juice', 'نوشیدنی‌ها', 'لیوان');
