-- Gymlic preset library seed data, ported verbatim from
-- supabase/migrations 0012 (exercises) and 0027 (foods).
-- Presets are the rows with created_by = NULL; every trainer sees them.
-- Safe to re-run: it clears the presets first, leaving custom entries alone.

SET NAMES utf8mb4;

DELETE FROM exercises WHERE created_by IS NULL;
INSERT INTO exercises (id, name, name_en, muscle_group) VALUES
  (UUID(), 'پرس سینه هالتر (نیمکت صاف)', 'Barbell Bench Press', 'سینه'),
  (UUID(), 'پرس سینه دمبل', 'Dumbbell Bench Press', 'سینه'),
  (UUID(), 'پرس بالا سینه هالتر', 'Incline Barbell Bench Press', 'سینه'),
  (UUID(), 'پرس بالا سینه دمبل', 'Incline Dumbbell Press', 'سینه'),
  (UUID(), 'شنا سوئدی', 'Push-Up', 'سینه'),
  (UUID(), 'قفسه سینه با دمبل', 'Dumbbell Fly', 'سینه'),
  (UUID(), 'کراس اُور سیم‌کش', 'Cable Crossover', 'سینه'),
  (UUID(), 'بارفیکس', 'Pull-Up', 'پشت'),
  (UUID(), 'زیر بغل سیم‌کش دست باز', 'Wide-Grip Lat Pulldown', 'پشت'),
  (UUID(), 'پارویی هالتر خم', 'Barbell Bent-Over Row', 'پشت'),
  (UUID(), 'پارویی دمبل تک‌خم', 'One-Arm Dumbbell Row', 'پشت'),
  (UUID(), 'ددلیفت', 'Deadlift', 'پشت'),
  (UUID(), 'پارویی سیم‌کش نشسته', 'Seated Cable Row', 'پشت'),
  (UUID(), 'شراگ با هالتر', 'Barbell Shrug', 'پشت'),
  (UUID(), 'اسکات با هالتر', 'Barbell Squat', 'پا'),
  (UUID(), 'پرس پا با دستگاه', 'Leg Press', 'پا'),
  (UUID(), 'لانگز با دمبل', 'Dumbbell Lunge', 'پا'),
  (UUID(), 'جلو پا با دستگاه', 'Leg Extension', 'پا'),
  (UUID(), 'پشت پا با دستگاه', 'Leg Curl', 'پا'),
  (UUID(), 'ددلیفت رومانیایی', 'Romanian Deadlift', 'پا'),
  (UUID(), 'هیپ تراست', 'Hip Thrust', 'پا'),
  (UUID(), 'ساق پا ایستاده', 'Standing Calf Raise', 'ساق پا'),
  (UUID(), 'ساق پا نشسته', 'Seated Calf Raise', 'ساق پا'),
  (UUID(), 'ساق پا با دستگاه اسمیت', 'Smith Machine Calf Raise', 'ساق پا'),
  (UUID(), 'پرس سرشانه هالتر', 'Barbell Overhead Press', 'شانه'),
  (UUID(), 'پرس سرشانه دمبل', 'Dumbbell Shoulder Press', 'شانه'),
  (UUID(), 'نشر جانب با دمبل', 'Dumbbell Lateral Raise', 'شانه'),
  (UUID(), 'نشر خم (دلتوئید خلفی)', 'Bent-Over Rear Delt Raise', 'شانه'),
  (UUID(), 'فیس پول', 'Face Pull', 'شانه'),
  (UUID(), 'نشر جلو با دمبل', 'Dumbbell Front Raise', 'شانه'),
  (UUID(), 'جلو بازو هالتر', 'Barbell Curl', 'جلو بازو'),
  (UUID(), 'جلو بازو دمبل', 'Dumbbell Curl', 'جلو بازو'),
  (UUID(), 'جلو بازو چکشی', 'Hammer Curl', 'جلو بازو'),
  (UUID(), 'جلو بازو لاری', 'Preacher Curl', 'جلو بازو'),
  (UUID(), 'جلو بازو سیم‌کش', 'Cable Curl', 'جلو بازو'),
  (UUID(), 'پشت بازو سیم‌کش میله صاف', 'Triceps Pushdown', 'پشت بازو'),
  (UUID(), 'پشت بازو هالتر خوابیده', 'Lying Triceps Extension (Skull Crusher)', 'پشت بازو'),
  (UUID(), 'دیپ روی موازی', 'Triceps Dip', 'پشت بازو'),
  (UUID(), 'پشت بازو دمبل تک‌خم', 'Dumbbell Kickback', 'پشت بازو'),
  (UUID(), 'پشت بازو فرانسوی', 'Overhead Triceps Extension', 'پشت بازو'),
  (UUID(), 'کرانچ', 'Crunch', 'شکم'),
  (UUID(), 'پلانک', 'Plank', 'شکم'),
  (UUID(), 'بالا آوردن پا آویزان', 'Hanging Leg Raise', 'شکم'),
  (UUID(), 'کرانچ سیم‌کش', 'Cable Crunch', 'شکم'),
  (UUID(), 'پیچ روسی', 'Russian Twist', 'شکم'),
  (UUID(), 'زیر شکم با دستگاه', 'Ab Machine Crunch', 'شکم'),
  (UUID(), 'دویدن', 'Running', 'کاردیو'),
  (UUID(), 'طناب زدن', 'Jump Rope', 'کاردیو'),
  (UUID(), 'دوچرخه ثابت', 'Stationary Bike', 'کاردیو'),
  (UUID(), 'الپتیکال', 'Elliptical Trainer', 'کاردیو');

DELETE FROM foods WHERE created_by IS NULL;
INSERT INTO foods (id, name, name_en, category, default_unit) VALUES
  (UUID(), 'سینه مرغ', 'Chicken Breast', 'منابع پروتئینی', 'گرم'),
  (UUID(), 'ران مرغ بدون پوست', 'Skinless Chicken Thigh', 'منابع پروتئینی', 'گرم'),
  (UUID(), 'گوشت گوساله کم‌چرب', 'Lean Beef', 'منابع پروتئینی', 'گرم'),
  (UUID(), 'گوشت گوسفند کم‌چرب', 'Lean Lamb', 'منابع پروتئینی', 'گرم'),
  (UUID(), 'ماهی قزل‌آلا', 'Trout', 'منابع پروتئینی', 'گرم'),
  (UUID(), 'ماهی سالمون', 'Salmon', 'منابع پروتئینی', 'گرم'),
  (UUID(), 'تن ماهی در آب', 'Canned Tuna in Water', 'منابع پروتئینی', 'گرم'),
  (UUID(), 'میگو', 'Shrimp', 'منابع پروتئینی', 'گرم'),
  (UUID(), 'تخم‌مرغ کامل', 'Whole Egg', 'منابع پروتئینی', 'عدد'),
  (UUID(), 'سفیده تخم‌مرغ', 'Egg White', 'منابع پروتئینی', 'عدد'),
  (UUID(), 'بوقلمون', 'Turkey Breast', 'منابع پروتئینی', 'گرم'),
  (UUID(), 'برنج سفید پخته', 'Cooked White Rice', 'کربوهیدرات و غلات', 'گرم'),
  (UUID(), 'برنج قهوه‌ای پخته', 'Cooked Brown Rice', 'کربوهیدرات و غلات', 'گرم'),
  (UUID(), 'جو دوسر (اُتمیل)', 'Rolled Oats', 'کربوهیدرات و غلات', 'گرم'),
  (UUID(), 'نان سنگک', 'Sangak Bread', 'کربوهیدرات و غلات', 'برش'),
  (UUID(), 'نان بربری', 'Barbari Bread', 'کربوهیدرات و غلات', 'برش'),
  (UUID(), 'نان جو', 'Barley Bread', 'کربوهیدرات و غلات', 'برش'),
  (UUID(), 'ماکارونی پخته', 'Cooked Pasta', 'کربوهیدرات و غلات', 'گرم'),
  (UUID(), 'سیب‌زمینی آب‌پز', 'Boiled Potato', 'کربوهیدرات و غلات', 'گرم'),
  (UUID(), 'سیب‌زمینی شیرین', 'Sweet Potato', 'کربوهیدرات و غلات', 'گرم'),
  (UUID(), 'کینوا پخته', 'Cooked Quinoa', 'کربوهیدرات و غلات', 'گرم'),
  (UUID(), 'ذرت پخته', 'Cooked Corn', 'کربوهیدرات و غلات', 'گرم'),
  (UUID(), 'عدس پخته', 'Cooked Lentils', 'حبوبات', 'گرم'),
  (UUID(), 'لپه پخته', 'Cooked Split Peas', 'حبوبات', 'گرم'),
  (UUID(), 'نخود پخته', 'Cooked Chickpeas', 'حبوبات', 'گرم'),
  (UUID(), 'لوبیا قرمز پخته', 'Cooked Red Beans', 'حبوبات', 'گرم'),
  (UUID(), 'لوبیا چیتی پخته', 'Cooked Pinto Beans', 'حبوبات', 'گرم'),
  (UUID(), 'سویا', 'Soy Chunks', 'حبوبات', 'گرم'),
  (UUID(), 'شیر کم‌چرب', 'Low-Fat Milk', 'لبنیات', 'لیوان'),
  (UUID(), 'ماست کم‌چرب', 'Low-Fat Yogurt', 'لبنیات', 'گرم'),
  (UUID(), 'ماست یونانی', 'Greek Yogurt', 'لبنیات', 'گرم'),
  (UUID(), 'پنیر کم‌چرب', 'Low-Fat Cheese', 'لبنیات', 'گرم'),
  (UUID(), 'کشک', 'Kashk', 'لبنیات', 'قاشق غذاخوری'),
  (UUID(), 'دوغ بدون گاز', 'Doogh', 'لبنیات', 'لیوان'),
  (UUID(), 'شیر سویا', 'Soy Milk', 'لبنیات', 'لیوان'),
  (UUID(), 'کاهو', 'Lettuce', 'سبزیجات', 'گرم'),
  (UUID(), 'گوجه‌فرنگی', 'Tomato', 'سبزیجات', 'عدد'),
  (UUID(), 'خیار', 'Cucumber', 'سبزیجات', 'عدد'),
  (UUID(), 'کلم بروکلی', 'Broccoli', 'سبزیجات', 'گرم'),
  (UUID(), 'اسفناج', 'Spinach', 'سبزیجات', 'گرم'),
  (UUID(), 'هویج', 'Carrot', 'سبزیجات', 'عدد'),
  (UUID(), 'کدو سبز', 'Zucchini', 'سبزیجات', 'گرم'),
  (UUID(), 'فلفل دلمه‌ای', 'Bell Pepper', 'سبزیجات', 'عدد'),
  (UUID(), 'پیاز', 'Onion', 'سبزیجات', 'عدد'),
  (UUID(), 'سبزی خوردن', 'Fresh Herbs', 'سبزیجات', 'مشت'),
  (UUID(), 'موز', 'Banana', 'میوه‌ها', 'عدد'),
  (UUID(), 'سیب', 'Apple', 'میوه‌ها', 'عدد'),
  (UUID(), 'پرتقال', 'Orange', 'میوه‌ها', 'عدد'),
  (UUID(), 'خرما', 'Date', 'میوه‌ها', 'عدد'),
  (UUID(), 'انگور', 'Grapes', 'میوه‌ها', 'گرم'),
  (UUID(), 'توت‌فرنگی', 'Strawberry', 'میوه‌ها', 'گرم'),
  (UUID(), 'کیوی', 'Kiwi', 'میوه‌ها', 'عدد'),
  (UUID(), 'هندوانه', 'Watermelon', 'میوه‌ها', 'گرم'),
  (UUID(), 'آناناس', 'Pineapple', 'میوه‌ها', 'گرم'),
  (UUID(), 'بادام', 'Almonds', 'چربی‌های سالم', 'گرم'),
  (UUID(), 'گردو', 'Walnuts', 'چربی‌های سالم', 'گرم'),
  (UUID(), 'پسته', 'Pistachios', 'چربی‌های سالم', 'گرم'),
  (UUID(), 'بادام‌زمینی', 'Peanuts', 'چربی‌های سالم', 'گرم'),
  (UUID(), 'کره بادام‌زمینی', 'Peanut Butter', 'چربی‌های سالم', 'قاشق غذاخوری'),
  (UUID(), 'روغن زیتون', 'Olive Oil', 'چربی‌های سالم', 'قاشق غذاخوری'),
  (UUID(), 'آووکادو', 'Avocado', 'چربی‌های سالم', 'عدد'),
  (UUID(), 'تخم چیا', 'Chia Seeds', 'چربی‌های سالم', 'قاشق غذاخوری'),
  (UUID(), 'تخمه کدو', 'Pumpkin Seeds', 'چربی‌های سالم', 'گرم'),
  (UUID(), 'پودر پروتئین وی', 'Whey Protein Powder', 'مکمل‌ها', 'اسکوپ'),
  (UUID(), 'کراتین مونوهیدرات', 'Creatine Monohydrate', 'مکمل‌ها', 'گرم'),
  (UUID(), 'گینر', 'Mass Gainer', 'مکمل‌ها', 'اسکوپ'),
  (UUID(), 'مولتی‌ویتامین', 'Multivitamin', 'مکمل‌ها', 'عدد'),
  (UUID(), 'امگا ۳', 'Omega-3', 'مکمل‌ها', 'عدد'),
  (UUID(), 'آب', 'Water', 'نوشیدنی‌ها', 'لیوان'),
  (UUID(), 'چای سبز', 'Green Tea', 'نوشیدنی‌ها', 'لیوان'),
  (UUID(), 'قهوه تلخ', 'Black Coffee', 'نوشیدنی‌ها', 'فنجان'),
  (UUID(), 'آب‌میوه طبیعی', 'Fresh Fruit Juice', 'نوشیدنی‌ها', 'لیوان');

-- Supplements (shared library)
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'پودر پروتئین وی', 'Whey Protein', 'پروتئین سریع‌جذب؛ معمولاً بعد از تمرین یا بین وعده‌ها مصرف می‌شود.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Whey Protein' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'کازئین', 'Casein Protein', 'پروتئین کندجذب؛ معمولاً قبل از خواب مصرف می‌شود.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Casein Protein' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'گینر', 'Mass Gainer', 'مکمل پرکالری برای افزایش وزن؛ مقدار مصرف به کالری موردنیاز فرد بستگی دارد.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Mass Gainer' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'کراتین مونوهیدرات', 'Creatine Monohydrate', 'پرمصرف‌ترین مکمل قدرتی؛ معمولاً روزانه ۳ تا ۵ گرم.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Creatine Monohydrate' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'بی‌سی‌ای‌ای', 'BCAA', 'آمینواسیدهای شاخه‌دار؛ معمولاً حین یا اطراف تمرین.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'BCAA' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'آمینو اسید ضروری', 'EAA', 'مجموعه آمینواسیدهای ضروری؛ معمولاً حین یا اطراف تمرین.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'EAA' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'گلوتامین', 'Glutamine', 'آمینواسید کمکی برای ریکاوری؛ معمولاً بعد از تمرین یا قبل از خواب.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Glutamine' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'پیش‌تمرین', 'Pre-Workout', 'مکمل افزایش انرژی و تمرکز؛ معمولاً ۲۰ تا ۳۰ دقیقه قبل از تمرین. به کافئین آن دقت کنید.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Pre-Workout' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'کافئین', 'Caffeine', 'محرک افزایش هوشیاری و عملکرد؛ معمولاً قبل از تمرین، نه نزدیک خواب.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Caffeine' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'بتا آلانین', 'Beta-Alanine', 'برای تحمل تمرین‌های پرتکرار؛ ممکن است گزگز موقت ایجاد کند.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Beta-Alanine' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'سیترولین مالات', 'Citrulline Malate', 'مکمل پمپ و استقامت؛ معمولاً قبل از تمرین.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Citrulline Malate' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'ال‌کارنیتین', 'L-Carnitine', 'مکمل مرتبط با متابولیسم چربی؛ معمولاً قبل از تمرین.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'L-Carnitine' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'امگا ۳ (روغن ماهی)', 'Omega-3 Fish Oil', 'اسیدهای چرب ضروری؛ معمولاً همراه غذا.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Omega-3 Fish Oil' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'مولتی‌ویتامین', 'Multivitamin', 'مجموعه ویتامین‌ها و مواد معدنی؛ معمولاً همراه صبحانه.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Multivitamin' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'ویتامین دی ۳', 'Vitamin D3', 'ویتامین محلول در چربی؛ معمولاً همراه یک وعدهٔ چرب.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Vitamin D3' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'ویتامین ث', 'Vitamin C', 'ویتامین آنتی‌اکسیدان؛ معمولاً همراه غذا.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Vitamin C' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'ویتامین ب ۱۲', 'Vitamin B12', 'ویتامین گروه ب؛ مصرف‌کنندگان رژیم گیاهی بیشتر به آن نیاز دارند.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Vitamin B12' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'منیزیم', 'Magnesium', 'ماده معدنی مرتبط با ریکاوری و خواب؛ معمولاً شب.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Magnesium' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'زینک', 'Zinc', 'ماده معدنی کم‌مقدار؛ معمولاً همراه غذا.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Zinc' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'زد‌ام‌آ', 'ZMA', 'ترکیب زینک، منیزیم و ویتامین ب ۶؛ معمولاً قبل از خواب و با معده خالی.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'ZMA' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'کلسیم', 'Calcium', 'ماده معدنی استخوان‌ساز؛ معمولاً همراه غذا.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Calcium' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'آهن', 'Iron', 'فقط با تشخیص مربی یا پزشک؛ مقدار زیاد آن مضر است.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Iron' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'کلاژن', 'Collagen', 'پروتئین مفصل و بافت همبند؛ معمولاً یک بار در روز.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Collagen' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'گلوکوزامین', 'Glucosamine', 'مکمل حمایت از مفاصل؛ معمولاً همراه غذا.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Glucosamine' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'الکترولیت', 'Electrolytes', 'املاح جبران‌کنندهٔ تعریق؛ معمولاً حین تمرین طولانی یا هوای گرم.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Electrolytes' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'اشواگاندا', 'Ashwagandha', 'گیاه تطبیق‌دهندهٔ استرس؛ معمولاً یک بار در روز.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Ashwagandha' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'ملاتونین', 'Melatonin', 'هورمون خواب؛ فقط با تشخیص مربی یا پزشک و قبل از خواب.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Melatonin' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'پروبیوتیک', 'Probiotic', 'باکتری‌های مفید گوارشی؛ معمولاً ناشتا یا همراه صبحانه.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Probiotic' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'اچ‌ام‌بی', 'HMB', 'مکمل کاهش تخریب عضلانی؛ معمولاً سه وعده در روز.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'HMB' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'پروتئین بار', 'Protein Bar', 'میان‌وعدهٔ پرپروتئین؛ مقدار کالری برندها متفاوت است.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Protein Bar' AND created_by IS NULL);
