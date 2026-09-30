-- Calories and macros for the preset foods (created_by IS NULL).
-- Run in phpMyAdmin -> SQL, AFTER the four statements of the structured-nutrition
-- PR, and after taking a backup.
--
-- Foods are matched on the English name (name_en), not the Persian one: Persian
-- names carry invisible characters (the half-space in «کم‌چرب») that get lost
-- or altered when SQL is copied through a browser, and the UPDATE then matches
-- nothing without any error.
--
-- Safe to run twice: it only fills foods whose calories_per_unit is still NULL,
-- so nothing anyone entered by hand is touched.
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

UPDATE foods SET calories_per_unit = 1.65, protein_g = 0.31, carbs_g = 0, fat_g = 0.036 WHERE name_en = 'Chicken Breast' AND created_by IS NULL AND calories_per_unit IS NULL;  -- سینه مرغ
UPDATE foods SET calories_per_unit = 2.09, protein_g = 0.26, carbs_g = 0, fat_g = 0.109 WHERE name_en = 'Skinless Chicken Thigh' AND created_by IS NULL AND calories_per_unit IS NULL;  -- ران مرغ بدون پوست
UPDATE foods SET calories_per_unit = 1.9, protein_g = 0.29, carbs_g = 0, fat_g = 0.08 WHERE name_en = 'Lean Beef' AND created_by IS NULL AND calories_per_unit IS NULL;  -- گوشت گوساله کم‌چرب
UPDATE foods SET calories_per_unit = 2.06, protein_g = 0.28, carbs_g = 0, fat_g = 0.1 WHERE name_en = 'Lean Lamb' AND created_by IS NULL AND calories_per_unit IS NULL;  -- گوشت گوسفند کم‌چرب
UPDATE foods SET calories_per_unit = 1.68, protein_g = 0.238, carbs_g = 0, fat_g = 0.07 WHERE name_en = 'Trout' AND created_by IS NULL AND calories_per_unit IS NULL;  -- ماهی قزل‌آلا
UPDATE foods SET calories_per_unit = 2.06, protein_g = 0.22, carbs_g = 0, fat_g = 0.12 WHERE name_en = 'Salmon' AND created_by IS NULL AND calories_per_unit IS NULL;  -- ماهی سالمون
UPDATE foods SET calories_per_unit = 1.16, protein_g = 0.26, carbs_g = 0, fat_g = 0.01 WHERE name_en = 'Canned Tuna in Water' AND created_by IS NULL AND calories_per_unit IS NULL;  -- تن ماهی در آب
UPDATE foods SET calories_per_unit = 0.99, protein_g = 0.24, carbs_g = 0.002, fat_g = 0.003 WHERE name_en = 'Shrimp' AND created_by IS NULL AND calories_per_unit IS NULL;  -- میگو
UPDATE foods SET calories_per_unit = 71.5, protein_g = 6.3, carbs_g = 0.35, fat_g = 4.75 WHERE name_en = 'Whole Egg' AND created_by IS NULL AND calories_per_unit IS NULL;  -- تخم‌مرغ کامل | 1 واحد ≈ 50 g
UPDATE foods SET calories_per_unit = 17.16, protein_g = 3.597, carbs_g = 0.231, fat_g = 0.066 WHERE name_en = 'Egg White' AND created_by IS NULL AND calories_per_unit IS NULL;  -- سفیده تخم‌مرغ | 1 واحد ≈ 33 g
UPDATE foods SET calories_per_unit = 1.35, protein_g = 0.3, carbs_g = 0, fat_g = 0.007 WHERE name_en = 'Turkey Breast' AND created_by IS NULL AND calories_per_unit IS NULL;  -- بوقلمون
UPDATE foods SET calories_per_unit = 1.3, protein_g = 0.027, carbs_g = 0.28, fat_g = 0.003 WHERE name_en = 'Cooked White Rice' AND created_by IS NULL AND calories_per_unit IS NULL;  -- برنج سفید پخته
UPDATE foods SET calories_per_unit = 1.23, protein_g = 0.027, carbs_g = 0.256, fat_g = 0.01 WHERE name_en = 'Cooked Brown Rice' AND created_by IS NULL AND calories_per_unit IS NULL;  -- برنج قهوه‌ای پخته
UPDATE foods SET calories_per_unit = 3.89, protein_g = 0.169, carbs_g = 0.663, fat_g = 0.069 WHERE name_en = 'Rolled Oats' AND created_by IS NULL AND calories_per_unit IS NULL;  -- جو دوسر (اُتمیل)
UPDATE foods SET calories_per_unit = 104, protein_g = 3.6, carbs_g = 21.6, fat_g = 0.6 WHERE name_en = 'Sangak Bread' AND created_by IS NULL AND calories_per_unit IS NULL;  -- نان سنگک | 1 واحد ≈ 40 g
UPDATE foods SET calories_per_unit = 112, protein_g = 3.6, carbs_g = 22.4, fat_g = 0.8 WHERE name_en = 'Barbari Bread' AND created_by IS NULL AND calories_per_unit IS NULL;  -- نان بربری | 1 واحد ≈ 40 g
UPDATE foods SET calories_per_unit = 100, protein_g = 4, carbs_g = 20, fat_g = 0.8 WHERE name_en = 'Barley Bread' AND created_by IS NULL AND calories_per_unit IS NULL;  -- نان جو | 1 واحد ≈ 40 g
UPDATE foods SET calories_per_unit = 1.58, protein_g = 0.058, carbs_g = 0.309, fat_g = 0.009 WHERE name_en = 'Cooked Pasta' AND created_by IS NULL AND calories_per_unit IS NULL;  -- ماکارونی پخته
UPDATE foods SET calories_per_unit = 0.87, protein_g = 0.019, carbs_g = 0.201, fat_g = 0.001 WHERE name_en = 'Boiled Potato' AND created_by IS NULL AND calories_per_unit IS NULL;  -- سیب‌زمینی آب‌پز
UPDATE foods SET calories_per_unit = 0.9, protein_g = 0.02, carbs_g = 0.207, fat_g = 0.002 WHERE name_en = 'Sweet Potato' AND created_by IS NULL AND calories_per_unit IS NULL;  -- سیب‌زمینی شیرین
UPDATE foods SET calories_per_unit = 1.2, protein_g = 0.044, carbs_g = 0.213, fat_g = 0.019 WHERE name_en = 'Cooked Quinoa' AND created_by IS NULL AND calories_per_unit IS NULL;  -- کینوا پخته
UPDATE foods SET calories_per_unit = 0.96, protein_g = 0.034, carbs_g = 0.21, fat_g = 0.015 WHERE name_en = 'Cooked Corn' AND created_by IS NULL AND calories_per_unit IS NULL;  -- ذرت پخته
UPDATE foods SET calories_per_unit = 1.16, protein_g = 0.09, carbs_g = 0.201, fat_g = 0.004 WHERE name_en = 'Cooked Lentils' AND created_by IS NULL AND calories_per_unit IS NULL;  -- عدس پخته
UPDATE foods SET calories_per_unit = 1.18, protein_g = 0.083, carbs_g = 0.211, fat_g = 0.004 WHERE name_en = 'Cooked Split Peas' AND created_by IS NULL AND calories_per_unit IS NULL;  -- لپه پخته
UPDATE foods SET calories_per_unit = 1.64, protein_g = 0.089, carbs_g = 0.274, fat_g = 0.026 WHERE name_en = 'Cooked Chickpeas' AND created_by IS NULL AND calories_per_unit IS NULL;  -- نخود پخته
UPDATE foods SET calories_per_unit = 1.27, protein_g = 0.087, carbs_g = 0.228, fat_g = 0.005 WHERE name_en = 'Cooked Red Beans' AND created_by IS NULL AND calories_per_unit IS NULL;  -- لوبیا قرمز پخته
UPDATE foods SET calories_per_unit = 1.43, protein_g = 0.09, carbs_g = 0.262, fat_g = 0.007 WHERE name_en = 'Cooked Pinto Beans' AND created_by IS NULL AND calories_per_unit IS NULL;  -- لوبیا چیتی پخته
UPDATE foods SET calories_per_unit = 3.3, protein_g = 0.52, carbs_g = 0.3, fat_g = 0.01 WHERE name_en = 'Soy Chunks' AND created_by IS NULL AND calories_per_unit IS NULL;  -- سویا
UPDATE foods SET calories_per_unit = 102.9, protein_g = 8.33, carbs_g = 12.25, fat_g = 2.45 WHERE name_en = 'Low-Fat Milk' AND created_by IS NULL AND calories_per_unit IS NULL;  -- شیر کم‌چرب | 1 واحد ≈ 245 g
UPDATE foods SET calories_per_unit = 0.63, protein_g = 0.053, carbs_g = 0.07, fat_g = 0.016 WHERE name_en = 'Low-Fat Yogurt' AND created_by IS NULL AND calories_per_unit IS NULL;  -- ماست کم‌چرب
UPDATE foods SET calories_per_unit = 0.59, protein_g = 0.102, carbs_g = 0.036, fat_g = 0.004 WHERE name_en = 'Greek Yogurt' AND created_by IS NULL AND calories_per_unit IS NULL;  -- ماست یونانی
UPDATE foods SET calories_per_unit = 1.4, protein_g = 0.2, carbs_g = 0.03, fat_g = 0.05 WHERE name_en = 'Low-Fat Cheese' AND created_by IS NULL AND calories_per_unit IS NULL;  -- پنیر کم‌چرب
UPDATE foods SET calories_per_unit = 13.5, protein_g = 0.9, carbs_g = 1.05, fat_g = 0.6 WHERE name_en = 'Kashk' AND created_by IS NULL AND calories_per_unit IS NULL;  -- کشک | 1 واحد ≈ 15 g
UPDATE foods SET calories_per_unit = 73.5, protein_g = 4.165, carbs_g = 6.125, fat_g = 3.185 WHERE name_en = 'Doogh' AND created_by IS NULL AND calories_per_unit IS NULL;  -- دوغ بدون گاز | 1 واحد ≈ 245 g
UPDATE foods SET calories_per_unit = 80.85, protein_g = 7.105, carbs_g = 4.165, fat_g = 3.92 WHERE name_en = 'Soy Milk' AND created_by IS NULL AND calories_per_unit IS NULL;  -- شیر سویا | 1 واحد ≈ 245 g
UPDATE foods SET calories_per_unit = 0.15, protein_g = 0.014, carbs_g = 0.029, fat_g = 0.002 WHERE name_en = 'Lettuce' AND created_by IS NULL AND calories_per_unit IS NULL;  -- کاهو
UPDATE foods SET calories_per_unit = 21.6, protein_g = 1.08, carbs_g = 4.68, fat_g = 0.24 WHERE name_en = 'Tomato' AND created_by IS NULL AND calories_per_unit IS NULL;  -- گوجه‌فرنگی | 1 واحد ≈ 120 g
UPDATE foods SET calories_per_unit = 15, protein_g = 0.7, carbs_g = 3.6, fat_g = 0.1 WHERE name_en = 'Cucumber' AND created_by IS NULL AND calories_per_unit IS NULL;  -- خیار | 1 واحد ≈ 100 g
UPDATE foods SET calories_per_unit = 0.34, protein_g = 0.028, carbs_g = 0.066, fat_g = 0.004 WHERE name_en = 'Broccoli' AND created_by IS NULL AND calories_per_unit IS NULL;  -- کلم بروکلی
UPDATE foods SET calories_per_unit = 0.23, protein_g = 0.029, carbs_g = 0.036, fat_g = 0.004 WHERE name_en = 'Spinach' AND created_by IS NULL AND calories_per_unit IS NULL;  -- اسفناج
UPDATE foods SET calories_per_unit = 24.6, protein_g = 0.54, carbs_g = 5.76, fat_g = 0.12 WHERE name_en = 'Carrot' AND created_by IS NULL AND calories_per_unit IS NULL;  -- هویج | 1 واحد ≈ 60 g
UPDATE foods SET calories_per_unit = 0.17, protein_g = 0.012, carbs_g = 0.031, fat_g = 0.003 WHERE name_en = 'Zucchini' AND created_by IS NULL AND calories_per_unit IS NULL;  -- کدو سبز
UPDATE foods SET calories_per_unit = 37.2, protein_g = 1.2, carbs_g = 7.2, fat_g = 0.36 WHERE name_en = 'Bell Pepper' AND created_by IS NULL AND calories_per_unit IS NULL;  -- فلفل دلمه‌ای | 1 واحد ≈ 120 g
UPDATE foods SET calories_per_unit = 44, protein_g = 1.21, carbs_g = 10.23, fat_g = 0.11 WHERE name_en = 'Onion' AND created_by IS NULL AND calories_per_unit IS NULL;  -- پیاز | 1 واحد ≈ 110 g
UPDATE foods SET calories_per_unit = 9, protein_g = 0.9, carbs_g = 1.35, fat_g = 0.15 WHERE name_en = 'Fresh Herbs' AND created_by IS NULL AND calories_per_unit IS NULL;  -- سبزی خوردن | 1 واحد ≈ 30 g
UPDATE foods SET calories_per_unit = 105.02, protein_g = 1.298, carbs_g = 26.904, fat_g = 0.354 WHERE name_en = 'Banana' AND created_by IS NULL AND calories_per_unit IS NULL;  -- موز | 1 واحد ≈ 118 g
UPDATE foods SET calories_per_unit = 93.6, protein_g = 0.54, carbs_g = 24.84, fat_g = 0.36 WHERE name_en = 'Apple' AND created_by IS NULL AND calories_per_unit IS NULL;  -- سیب | 1 واحد ≈ 180 g
UPDATE foods SET calories_per_unit = 61.1, protein_g = 1.17, carbs_g = 15.34, fat_g = 0.13 WHERE name_en = 'Orange' AND created_by IS NULL AND calories_per_unit IS NULL;  -- پرتقال | 1 واحد ≈ 130 g
UPDATE foods SET calories_per_unit = 28.2, protein_g = 0.25, carbs_g = 7.5, fat_g = 0.04 WHERE name_en = 'Date' AND created_by IS NULL AND calories_per_unit IS NULL;  -- خرما | 1 واحد ≈ 10 g
UPDATE foods SET calories_per_unit = 0.69, protein_g = 0.007, carbs_g = 0.181, fat_g = 0.002 WHERE name_en = 'Grapes' AND created_by IS NULL AND calories_per_unit IS NULL;  -- انگور
UPDATE foods SET calories_per_unit = 0.32, protein_g = 0.007, carbs_g = 0.077, fat_g = 0.003 WHERE name_en = 'Strawberry' AND created_by IS NULL AND calories_per_unit IS NULL;  -- توت‌فرنگی
UPDATE foods SET calories_per_unit = 45.75, protein_g = 0.825, carbs_g = 11.025, fat_g = 0.375 WHERE name_en = 'Kiwi' AND created_by IS NULL AND calories_per_unit IS NULL;  -- کیوی | 1 واحد ≈ 75 g
UPDATE foods SET calories_per_unit = 0.3, protein_g = 0.006, carbs_g = 0.076, fat_g = 0.002 WHERE name_en = 'Watermelon' AND created_by IS NULL AND calories_per_unit IS NULL;  -- هندوانه
UPDATE foods SET calories_per_unit = 0.5, protein_g = 0.005, carbs_g = 0.131, fat_g = 0.001 WHERE name_en = 'Pineapple' AND created_by IS NULL AND calories_per_unit IS NULL;  -- آناناس
UPDATE foods SET calories_per_unit = 5.79, protein_g = 0.212, carbs_g = 0.216, fat_g = 0.499 WHERE name_en = 'Almonds' AND created_by IS NULL AND calories_per_unit IS NULL;  -- بادام
UPDATE foods SET calories_per_unit = 6.54, protein_g = 0.152, carbs_g = 0.137, fat_g = 0.652 WHERE name_en = 'Walnuts' AND created_by IS NULL AND calories_per_unit IS NULL;  -- گردو
UPDATE foods SET calories_per_unit = 5.6, protein_g = 0.202, carbs_g = 0.272, fat_g = 0.453 WHERE name_en = 'Pistachios' AND created_by IS NULL AND calories_per_unit IS NULL;  -- پسته
UPDATE foods SET calories_per_unit = 5.67, protein_g = 0.258, carbs_g = 0.161, fat_g = 0.492 WHERE name_en = 'Peanuts' AND created_by IS NULL AND calories_per_unit IS NULL;  -- بادام‌زمینی
UPDATE foods SET calories_per_unit = 94.08, protein_g = 4, carbs_g = 3.2, fat_g = 8 WHERE name_en = 'Peanut Butter' AND created_by IS NULL AND calories_per_unit IS NULL;  -- کره بادام‌زمینی | 1 واحد ≈ 16 g
UPDATE foods SET calories_per_unit = 119.34, protein_g = 0, carbs_g = 0, fat_g = 13.5 WHERE name_en = 'Olive Oil' AND created_by IS NULL AND calories_per_unit IS NULL;  -- روغن زیتون | 1 واحد ≈ 13.5 g
UPDATE foods SET calories_per_unit = 240, protein_g = 3, carbs_g = 12.75, fat_g = 22.05 WHERE name_en = 'Avocado' AND created_by IS NULL AND calories_per_unit IS NULL;  -- آووکادو | 1 واحد ≈ 150 g
UPDATE foods SET calories_per_unit = 58.32, protein_g = 1.98, carbs_g = 5.052, fat_g = 3.684 WHERE name_en = 'Chia Seeds' AND created_by IS NULL AND calories_per_unit IS NULL;  -- تخم چیا | 1 واحد ≈ 12 g
UPDATE foods SET calories_per_unit = 5.59, protein_g = 0.302, carbs_g = 0.107, fat_g = 0.491 WHERE name_en = 'Pumpkin Seeds' AND created_by IS NULL AND calories_per_unit IS NULL;  -- تخمه کدو
UPDATE foods SET calories_per_unit = 0, protein_g = 0, carbs_g = 0, fat_g = 0 WHERE name_en = 'Creatine Monohydrate' AND created_by IS NULL AND calories_per_unit IS NULL;  -- کراتین مونوهیدرات
UPDATE foods SET calories_per_unit = 0, protein_g = 0, carbs_g = 0, fat_g = 0 WHERE name_en = 'Water' AND created_by IS NULL AND calories_per_unit IS NULL;  -- آب | 1 واحد ≈ 240 g
UPDATE foods SET calories_per_unit = 0, protein_g = 0, carbs_g = 0, fat_g = 0 WHERE name_en = 'Green Tea' AND created_by IS NULL AND calories_per_unit IS NULL;  -- چای سبز | 1 واحد ≈ 240 g
UPDATE foods SET calories_per_unit = 1.2, protein_g = 0.12, carbs_g = 0, fat_g = 0 WHERE name_en = 'Black Coffee' AND created_by IS NULL AND calories_per_unit IS NULL;  -- قهوه تلخ | 1 واحد ≈ 120 g
UPDATE foods SET calories_per_unit = 111.6, protein_g = 1.736, carbs_g = 25.792, fat_g = 0.496 WHERE name_en = 'Fresh Fruit Juice' AND created_by IS NULL AND calories_per_unit IS NULL;  -- آب‌میوه طبیعی | 1 واحد ≈ 248 g
UPDATE foods SET calories_per_unit = 120, protein_g = 24, carbs_g = 3, fat_g = 1.5 WHERE name_en = 'Whey Protein Powder' AND created_by IS NULL AND calories_per_unit IS NULL;  -- پودر پروتئین وی | per scoop/capsule, typical label
UPDATE foods SET calories_per_unit = 0, protein_g = 0, carbs_g = 0, fat_g = 0 WHERE name_en = 'Multivitamin' AND created_by IS NULL AND calories_per_unit IS NULL;  -- مولتی‌ویتامین | per scoop/capsule, typical label
UPDATE foods SET calories_per_unit = 10, protein_g = 0, carbs_g = 0, fat_g = 1 WHERE name_en = 'Omega-3' AND created_by IS NULL AND calories_per_unit IS NULL;  -- امگا ۳ | per scoop/capsule, typical label

-- Check: still_empty should be 1 (گینر, left blank on purpose). If it is
-- larger, read the "Rows affected" of the UPDATE lines above, or see which
-- presets are still empty with:
--   SELECT name, name_en FROM foods WHERE created_by IS NULL AND calories_per_unit IS NULL;
SELECT COUNT(*) AS presets, SUM(calories_per_unit IS NULL) AS still_empty
FROM foods WHERE created_by IS NULL;
