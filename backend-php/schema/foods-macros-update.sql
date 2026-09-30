-- Calories and macros for the preset foods (created_by IS NULL).
-- Run in phpMyAdmin -> SQL, AFTER the four statements of the structured-nutrition
-- PR, and after taking a backup. Safe to run twice: it only fills foods whose
-- calories_per_unit is still NULL, so nothing anyone entered by hand is touched.
--
-- Values are per ONE default_unit of the food. They are typical reference
-- figures (USDA-style, cooked weights where the name says "پخته"), not lab
-- measurements. For foods counted per piece/slice/glass the portion weight is
-- an assumption (comment on each line) — adjust any you disagree with. Not
-- filled, on purpose: گینر (brands differ too much)
-- and every custom food a trainer added.

-- Per-gram values need more than 2 decimals (fat in chicken is 0.036 per gram),
-- so widen the columns first. Widening never loses existing data.
ALTER TABLE foods
  MODIFY calories_per_unit DECIMAL(9,4) NULL,
  MODIFY protein_g         DECIMAL(8,4) NULL,
  MODIFY carbs_g           DECIMAL(8,4) NULL,
  MODIFY fat_g             DECIMAL(8,4) NULL;

UPDATE foods SET calories_per_unit = 1.65, protein_g = 0.31, carbs_g = 0, fat_g = 0.036 WHERE name = 'سینه مرغ' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 2.09, protein_g = 0.26, carbs_g = 0, fat_g = 0.109 WHERE name = 'ران مرغ بدون پوست' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 1.9, protein_g = 0.29, carbs_g = 0, fat_g = 0.08 WHERE name = 'گوشت گوساله کم‌چرب' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 2.06, protein_g = 0.28, carbs_g = 0, fat_g = 0.1 WHERE name = 'گوشت گوسفند کم‌چرب' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 1.68, protein_g = 0.238, carbs_g = 0, fat_g = 0.07 WHERE name = 'ماهی قزل‌آلا' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 2.06, protein_g = 0.22, carbs_g = 0, fat_g = 0.12 WHERE name = 'ماهی سالمون' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 1.16, protein_g = 0.26, carbs_g = 0, fat_g = 0.01 WHERE name = 'تن ماهی در آب' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 0.99, protein_g = 0.24, carbs_g = 0.002, fat_g = 0.003 WHERE name = 'میگو' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 71.5, protein_g = 6.3, carbs_g = 0.35, fat_g = 4.75 WHERE name = 'تخم‌مرغ کامل' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 50 g
UPDATE foods SET calories_per_unit = 17.16, protein_g = 3.597, carbs_g = 0.231, fat_g = 0.066 WHERE name = 'سفیده تخم‌مرغ' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 33 g
UPDATE foods SET calories_per_unit = 1.35, protein_g = 0.3, carbs_g = 0, fat_g = 0.007 WHERE name = 'بوقلمون' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 1.3, protein_g = 0.027, carbs_g = 0.28, fat_g = 0.003 WHERE name = 'برنج سفید پخته' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 1.23, protein_g = 0.027, carbs_g = 0.256, fat_g = 0.01 WHERE name = 'برنج قهوه‌ای پخته' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 3.89, protein_g = 0.169, carbs_g = 0.663, fat_g = 0.069 WHERE name = 'جو دوسر (اُتمیل)' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 104, protein_g = 3.6, carbs_g = 21.6, fat_g = 0.6 WHERE name = 'نان سنگک' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 40 g
UPDATE foods SET calories_per_unit = 112, protein_g = 3.6, carbs_g = 22.4, fat_g = 0.8 WHERE name = 'نان بربری' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 40 g
UPDATE foods SET calories_per_unit = 100, protein_g = 4, carbs_g = 20, fat_g = 0.8 WHERE name = 'نان جو' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 40 g
UPDATE foods SET calories_per_unit = 1.58, protein_g = 0.058, carbs_g = 0.309, fat_g = 0.009 WHERE name = 'ماکارونی پخته' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 0.87, protein_g = 0.019, carbs_g = 0.201, fat_g = 0.001 WHERE name = 'سیب‌زمینی آب‌پز' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 0.9, protein_g = 0.02, carbs_g = 0.207, fat_g = 0.002 WHERE name = 'سیب‌زمینی شیرین' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 1.2, protein_g = 0.044, carbs_g = 0.213, fat_g = 0.019 WHERE name = 'کینوا پخته' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 0.96, protein_g = 0.034, carbs_g = 0.21, fat_g = 0.015 WHERE name = 'ذرت پخته' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 1.16, protein_g = 0.09, carbs_g = 0.201, fat_g = 0.004 WHERE name = 'عدس پخته' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 1.18, protein_g = 0.083, carbs_g = 0.211, fat_g = 0.004 WHERE name = 'لپه پخته' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 1.64, protein_g = 0.089, carbs_g = 0.274, fat_g = 0.026 WHERE name = 'نخود پخته' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 1.27, protein_g = 0.087, carbs_g = 0.228, fat_g = 0.005 WHERE name = 'لوبیا قرمز پخته' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 1.43, protein_g = 0.09, carbs_g = 0.262, fat_g = 0.007 WHERE name = 'لوبیا چیتی پخته' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 3.3, protein_g = 0.52, carbs_g = 0.3, fat_g = 0.01 WHERE name = 'سویا' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 102.9, protein_g = 8.33, carbs_g = 12.25, fat_g = 2.45 WHERE name = 'شیر کم‌چرب' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 245 g
UPDATE foods SET calories_per_unit = 0.63, protein_g = 0.053, carbs_g = 0.07, fat_g = 0.016 WHERE name = 'ماست کم‌چرب' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 0.59, protein_g = 0.102, carbs_g = 0.036, fat_g = 0.004 WHERE name = 'ماست یونانی' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 1.4, protein_g = 0.2, carbs_g = 0.03, fat_g = 0.05 WHERE name = 'پنیر کم‌چرب' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 13.5, protein_g = 0.9, carbs_g = 1.05, fat_g = 0.6 WHERE name = 'کشک' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 15 g
UPDATE foods SET calories_per_unit = 73.5, protein_g = 4.165, carbs_g = 6.125, fat_g = 3.185 WHERE name = 'دوغ بدون گاز' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 245 g
UPDATE foods SET calories_per_unit = 80.85, protein_g = 7.105, carbs_g = 4.165, fat_g = 3.92 WHERE name = 'شیر سویا' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 245 g
UPDATE foods SET calories_per_unit = 0.15, protein_g = 0.014, carbs_g = 0.029, fat_g = 0.002 WHERE name = 'کاهو' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 21.6, protein_g = 1.08, carbs_g = 4.68, fat_g = 0.24 WHERE name = 'گوجه‌فرنگی' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 120 g
UPDATE foods SET calories_per_unit = 15, protein_g = 0.7, carbs_g = 3.6, fat_g = 0.1 WHERE name = 'خیار' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 100 g
UPDATE foods SET calories_per_unit = 0.34, protein_g = 0.028, carbs_g = 0.066, fat_g = 0.004 WHERE name = 'کلم بروکلی' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 0.23, protein_g = 0.029, carbs_g = 0.036, fat_g = 0.004 WHERE name = 'اسفناج' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 24.6, protein_g = 0.54, carbs_g = 5.76, fat_g = 0.12 WHERE name = 'هویج' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 60 g
UPDATE foods SET calories_per_unit = 0.17, protein_g = 0.012, carbs_g = 0.031, fat_g = 0.003 WHERE name = 'کدو سبز' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 37.2, protein_g = 1.2, carbs_g = 7.2, fat_g = 0.36 WHERE name = 'فلفل دلمه‌ای' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 120 g
UPDATE foods SET calories_per_unit = 44, protein_g = 1.21, carbs_g = 10.23, fat_g = 0.11 WHERE name = 'پیاز' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 110 g
UPDATE foods SET calories_per_unit = 9, protein_g = 0.9, carbs_g = 1.35, fat_g = 0.15 WHERE name = 'سبزی خوردن' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 30 g
UPDATE foods SET calories_per_unit = 105.02, protein_g = 1.298, carbs_g = 26.904, fat_g = 0.354 WHERE name = 'موز' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 118 g
UPDATE foods SET calories_per_unit = 93.6, protein_g = 0.54, carbs_g = 24.84, fat_g = 0.36 WHERE name = 'سیب' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 180 g
UPDATE foods SET calories_per_unit = 61.1, protein_g = 1.17, carbs_g = 15.34, fat_g = 0.13 WHERE name = 'پرتقال' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 130 g
UPDATE foods SET calories_per_unit = 28.2, protein_g = 0.25, carbs_g = 7.5, fat_g = 0.04 WHERE name = 'خرما' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 10 g
UPDATE foods SET calories_per_unit = 0.69, protein_g = 0.007, carbs_g = 0.181, fat_g = 0.002 WHERE name = 'انگور' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 0.32, protein_g = 0.007, carbs_g = 0.077, fat_g = 0.003 WHERE name = 'توت‌فرنگی' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 45.75, protein_g = 0.825, carbs_g = 11.025, fat_g = 0.375 WHERE name = 'کیوی' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 75 g
UPDATE foods SET calories_per_unit = 0.3, protein_g = 0.006, carbs_g = 0.076, fat_g = 0.002 WHERE name = 'هندوانه' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 0.5, protein_g = 0.005, carbs_g = 0.131, fat_g = 0.001 WHERE name = 'آناناس' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 5.79, protein_g = 0.212, carbs_g = 0.216, fat_g = 0.499 WHERE name = 'بادام' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 6.54, protein_g = 0.152, carbs_g = 0.137, fat_g = 0.652 WHERE name = 'گردو' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 5.6, protein_g = 0.202, carbs_g = 0.272, fat_g = 0.453 WHERE name = 'پسته' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 5.67, protein_g = 0.258, carbs_g = 0.161, fat_g = 0.492 WHERE name = 'بادام‌زمینی' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 94.08, protein_g = 4, carbs_g = 3.2, fat_g = 8 WHERE name = 'کره بادام‌زمینی' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 16 g
UPDATE foods SET calories_per_unit = 119.34, protein_g = 0, carbs_g = 0, fat_g = 13.5 WHERE name = 'روغن زیتون' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 13.5 g
UPDATE foods SET calories_per_unit = 240, protein_g = 3, carbs_g = 12.75, fat_g = 22.05 WHERE name = 'آووکادو' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 150 g
UPDATE foods SET calories_per_unit = 58.32, protein_g = 1.98, carbs_g = 5.052, fat_g = 3.684 WHERE name = 'تخم چیا' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 12 g
UPDATE foods SET calories_per_unit = 5.59, protein_g = 0.302, carbs_g = 0.107, fat_g = 0.491 WHERE name = 'تخمه کدو' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 0, protein_g = 0, carbs_g = 0, fat_g = 0 WHERE name = 'کراتین مونوهیدرات' AND created_by IS NULL AND calories_per_unit IS NULL;
UPDATE foods SET calories_per_unit = 0, protein_g = 0, carbs_g = 0, fat_g = 0 WHERE name = 'آب' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 240 g
UPDATE foods SET calories_per_unit = 0, protein_g = 0, carbs_g = 0, fat_g = 0 WHERE name = 'چای سبز' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 240 g
UPDATE foods SET calories_per_unit = 1.2, protein_g = 0.12, carbs_g = 0, fat_g = 0 WHERE name = 'قهوه تلخ' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 120 g
UPDATE foods SET calories_per_unit = 111.6, protein_g = 1.736, carbs_g = 25.792, fat_g = 0.496 WHERE name = 'آب‌میوه طبیعی' AND created_by IS NULL AND calories_per_unit IS NULL;  -- 1 واحد ≈ 248 g
UPDATE foods SET calories_per_unit = 120, protein_g = 24, carbs_g = 3, fat_g = 1.5 WHERE name = 'پودر پروتئین وی' AND created_by IS NULL AND calories_per_unit IS NULL;  -- per scoop/capsule, typical label
UPDATE foods SET calories_per_unit = 0, protein_g = 0, carbs_g = 0, fat_g = 0 WHERE name = 'مولتی‌ویتامین' AND created_by IS NULL AND calories_per_unit IS NULL;  -- per scoop/capsule, typical label
UPDATE foods SET calories_per_unit = 10, protein_g = 0, carbs_g = 0, fat_g = 1 WHERE name = 'امگا ۳' AND created_by IS NULL AND calories_per_unit IS NULL;  -- per scoop/capsule, typical label
