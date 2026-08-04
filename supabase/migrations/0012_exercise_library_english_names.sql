-- ============================================================================
-- Gymlic — Exercise Library: English names + expanded preset list
--
-- Adds an English name alongside the Persian one (shown as "فارسی / English"
-- in the UI) and grows the preset list to 50 common exercises. Presets are
-- not yet referenced by any plan, so it's safe to replace them outright
-- rather than reconcile row-by-row.
-- ============================================================================

alter table exercises add column name_en text;

delete from exercises where created_by is null;

insert into exercises (name, name_en, muscle_group) values
  -- سینه
  ('پرس سینه هالتر (نیمکت صاف)', 'Barbell Bench Press', 'سینه'),
  ('پرس سینه دمبل', 'Dumbbell Bench Press', 'سینه'),
  ('پرس بالا سینه هالتر', 'Incline Barbell Bench Press', 'سینه'),
  ('پرس بالا سینه دمبل', 'Incline Dumbbell Press', 'سینه'),
  ('شنا سوئدی', 'Push-Up', 'سینه'),
  ('قفسه سینه با دمبل', 'Dumbbell Fly', 'سینه'),
  ('کراس اُور سیم‌کش', 'Cable Crossover', 'سینه'),
  -- پشت
  ('بارفیکس', 'Pull-Up', 'پشت'),
  ('زیر بغل سیم‌کش دست باز', 'Wide-Grip Lat Pulldown', 'پشت'),
  ('پارویی هالتر خم', 'Barbell Bent-Over Row', 'پشت'),
  ('پارویی دمبل تک‌خم', 'One-Arm Dumbbell Row', 'پشت'),
  ('ددلیفت', 'Deadlift', 'پشت'),
  ('پارویی سیم‌کش نشسته', 'Seated Cable Row', 'پشت'),
  ('شراگ با هالتر', 'Barbell Shrug', 'پشت'),
  -- پا
  ('اسکات با هالتر', 'Barbell Squat', 'پا'),
  ('پرس پا با دستگاه', 'Leg Press', 'پا'),
  ('لانگز با دمبل', 'Dumbbell Lunge', 'پا'),
  ('جلو پا با دستگاه', 'Leg Extension', 'پا'),
  ('پشت پا با دستگاه', 'Leg Curl', 'پا'),
  ('ددلیفت رومانیایی', 'Romanian Deadlift', 'پا'),
  ('هیپ تراست', 'Hip Thrust', 'پا'),
  -- ساق پا
  ('ساق پا ایستاده', 'Standing Calf Raise', 'ساق پا'),
  ('ساق پا نشسته', 'Seated Calf Raise', 'ساق پا'),
  ('ساق پا با دستگاه اسمیت', 'Smith Machine Calf Raise', 'ساق پا'),
  -- شانه
  ('پرس سرشانه هالتر', 'Barbell Overhead Press', 'شانه'),
  ('پرس سرشانه دمبل', 'Dumbbell Shoulder Press', 'شانه'),
  ('نشر جانب با دمبل', 'Dumbbell Lateral Raise', 'شانه'),
  ('نشر خم (دلتوئید خلفی)', 'Bent-Over Rear Delt Raise', 'شانه'),
  ('فیس پول', 'Face Pull', 'شانه'),
  ('نشر جلو با دمبل', 'Dumbbell Front Raise', 'شانه'),
  -- جلو بازو
  ('جلو بازو هالتر', 'Barbell Curl', 'جلو بازو'),
  ('جلو بازو دمبل', 'Dumbbell Curl', 'جلو بازو'),
  ('جلو بازو چکشی', 'Hammer Curl', 'جلو بازو'),
  ('جلو بازو لاری', 'Preacher Curl', 'جلو بازو'),
  ('جلو بازو سیم‌کش', 'Cable Curl', 'جلو بازو'),
  -- پشت بازو
  ('پشت بازو سیم‌کش میله صاف', 'Triceps Pushdown', 'پشت بازو'),
  ('پشت بازو هالتر خوابیده', 'Lying Triceps Extension (Skull Crusher)', 'پشت بازو'),
  ('دیپ روی موازی', 'Triceps Dip', 'پشت بازو'),
  ('پشت بازو دمبل تک‌خم', 'Dumbbell Kickback', 'پشت بازو'),
  ('پشت بازو فرانسوی', 'Overhead Triceps Extension', 'پشت بازو'),
  -- شکم
  ('کرانچ', 'Crunch', 'شکم'),
  ('پلانک', 'Plank', 'شکم'),
  ('بالا آوردن پا آویزان', 'Hanging Leg Raise', 'شکم'),
  ('کرانچ سیم‌کش', 'Cable Crunch', 'شکم'),
  ('پیچ روسی', 'Russian Twist', 'شکم'),
  ('زیر شکم با دستگاه', 'Ab Machine Crunch', 'شکم'),
  -- کاردیو
  ('دویدن', 'Running', 'کاردیو'),
  ('طناب زدن', 'Jump Rope', 'کاردیو'),
  ('دوچرخه ثابت', 'Stationary Bike', 'کاردیو'),
  ('الپتیکال', 'Elliptical Trainer', 'کاردیو');
