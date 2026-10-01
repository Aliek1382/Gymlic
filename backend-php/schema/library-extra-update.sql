-- 50 more exercises, 50 more foods and 20 more supplements for the shared library
-- (created_by IS NULL), each with the same details the existing presets carry:
-- Persian + English name, description, muscle group / category + unit, and for
-- foods the calories and macros.
-- Run from the admin panel's database page, or in phpMyAdmin -> SQL after taking
-- a backup. It needs foods-macros-update.sql (4-decimal macro columns) to have been
-- run first. Do NOT re-import schema.sql.
--
-- Every statement only adds a preset whose English name is not already in the
-- shared library, so this file is safe to run twice and never touches an entry
-- an admin or trainer edited, hid or added by hand. Photos / videos of the
-- exercises are not included: upload them from the admin Library page.
--
-- Food values are per ONE default_unit (per gram for «گرم»), typical USDA-style
-- reference figures, cooked weights where the name says «پخته»; per-piece
-- portion weights are stated in each description. Edit any of them from
-- /admin/library.

SET NAMES utf8mb4;

-- ===== Exercises (50) =====
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'پرس سینه هالتر شیب منفی', 'Decline Barbell Bench Press', 'آماده‌سازی: روی نیمکت شیب‌منفی دراز بکشید و پاها را محکم قفل کنید. هالتر را کمی بازتر از عرض شانه بگیرید.
اجرا: هالتر را کنترل‌شده تا پایین سینه بیاورید و با بازدم به بالا برانید.
نکته: بخش پایین سینه را بیشتر درگیر می‌کند؛ برای وزنه‌های سنگین حتماً از همیار استفاده کنید.
عضلات کمکی: سه‌سر بازو و دلتوئید جلویی.', 'سینه', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Decline Barbell Bench Press' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'پرس سینه با دستگاه', 'Machine Chest Press', 'آماده‌سازی: صندلی را طوری تنظیم کنید که دسته‌ها هم‌ارتفاع میانهٔ سینه باشند؛ کتف‌ها را عقب و پایین بدهید.
اجرا: دسته‌ها را به جلو برانید تا آرنج‌ها تقریباً صاف شوند، سپس آرام برگردید.
نکته: برای مبتدی‌ها و تمرین تا مرز ناتوانی بدون همیار مناسب است؛ شانه‌ها را بالا نیاورید.
عضلات کمکی: سه‌سر بازو و دلتوئید جلویی.', 'سینه', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Machine Chest Press' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'قفسه سینه با دستگاه (پک دک)', 'Pec Deck Fly', 'آماده‌سازی: پشت را به تکیه‌گاه بچسبانید و دسته‌ها را هم‌سطح سینه تنظیم کنید.
اجرا: با آرنج‌های اندکی خم، دسته‌ها را جلوی سینه به هم نزدیک کنید و یک ثانیه منقبض نگه دارید.
نکته: حرکت را با سنگینی وزنه نکشید؛ در برگشت بیش از حد عقب نروید تا فشار به شانه نیاید.
عضلات کمکی: دلتوئید جلویی.', 'سینه', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Pec Deck Fly' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'قفسه بالا سینه با دمبل', 'Incline Dumbbell Fly', 'آماده‌سازی: روی نیمکت شیب‌دار ۳۰ تا ۴۵ درجه دراز بکشید و دمبل‌ها را با کف دست رو به هم بالای سینه نگه دارید.
اجرا: دست‌ها را با آرنج اندکی خم، قوسی باز کنید تا کشش سینه حس شود و با همان مسیر ببندید.
نکته: وزنه سبک‌تر از پرس انتخاب کنید؛ آرنج را زیاد پایین نبرید.
عضلات کمکی: دلتوئید جلویی.', 'سینه', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Incline Dumbbell Fly' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'دیپ سینه', 'Chest Dip', 'آماده‌سازی: روی میله‌های موازی بالا بروید و بدن را کمی به جلو خم کنید، پاها را از پشت ضربدری کنید.
اجرا: آرنج‌ها را کمی به بیرون خم کنید و تا کشش سینه پایین بروید، سپس با فشار کف دست بالا بیایید.
نکته: برای شانه‌های حساس عمق را محدود کنید؛ برای سنگین‌تر شدن از کمربند وزنه استفاده کنید.
عضلات کمکی: سه‌سر بازو و دلتوئید جلویی.', 'سینه', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Chest Dip' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'پولاور با دمبل', 'Dumbbell Pullover', 'آماده‌سازی: عرضی روی نیمکت دراز بکشید و یک دمبل را با هر دو دست بالای سینه نگه دارید.
اجرا: با آرنج‌های اندکی خم، دمبل را قوسی پشت سر ببرید تا کشش قفسه و پشت حس شود و با همان مسیر برگردانید.
نکته: لگن را پایین نگه دارید و نفس عمیق بکشید؛ حرکتی برای کشش و حجم قفسه سینه است.
عضلات کمکی: عضلهٔ پشت (لَت) و سه‌سر بازو.', 'سینه', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Dumbbell Pullover' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'پارویی تی‌بار', 'T-Bar Row', 'آماده‌سازی: روی پد یا با زانوی خم و کمر صاف روی دستگاه T-Bar بایستید و دسته را بگیرید.
اجرا: آرنج‌ها را به سمت عقب بکشید تا وزنه نزدیک پایین سینه برسد و آرام رها کنید.
نکته: کمر را گرد نکنید و با تکان‌دادن بدن وزنه را بالا نبرید.
عضلات کمکی: دوسر بازو، دلتوئید پشتی و ذوزنقه.', 'پشت', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'T-Bar Row' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'بارفیکس دست جمع (چین‌آپ)', 'Chin-Up', 'آماده‌سازی: میله را با کف دست رو به خود و به‌اندازهٔ عرض شانه بگیرید و آویزان شوید.
اجرا: با کشیدن آرنج‌ها به پایین، چانه را بالای میله ببرید و آرام پایین بیایید.
نکته: از تاب‌دادن بدن بپرهیزید؛ اگر قدرت کافی ندارید از دستگاه کمک‌بارفیکس یا کش استفاده کنید.
عضلات کمکی: دوسر بازو و ساعد.', 'پشت', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Chin-Up' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'زیر بغل سیم‌کش دست جمع', 'Neutral-Grip Lat Pulldown', 'آماده‌سازی: با دستهٔ V شکل بنشینید، ران‌ها را زیر پد قفل کنید و سینه را بالا نگه دارید.
اجرا: دسته را به سمت بالای سینه بکشید و کتف‌ها را به هم نزدیک کنید، سپس کنترل‌شده رها کنید.
نکته: بدن را زیاد عقب نبرید؛ کشش را با آرنج‌ها هدایت کنید نه با دست‌ها.
عضلات کمکی: دوسر بازو و دلتوئید پشتی.', 'پشت', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Neutral-Grip Lat Pulldown' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'پول‌داون دست صاف', 'Straight-Arm Pulldown', 'آماده‌سازی: روبه‌روی قرقرهٔ بالا بایستید، میله را با دست‌های تقریباً صاف بگیرید و کمی به جلو خم شوید.
اجرا: میله را با دست‌های صاف تا کنار ران‌ها پایین بکشید و در پایین یک ثانیه منقبض کنید.
نکته: آرنج‌ها را قفل نکنید و فقط از شانه حرکت بدهید؛ برای ایزوله‌شدن عضلهٔ زیر بغل عالی است.
عضلات کمکی: سه‌سر بازو (سر بلند) و گرد بزرگ.', 'پشت', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Straight-Arm Pulldown' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'پارویی با پشتیبان سینه', 'Chest-Supported Row', 'آماده‌سازی: سینه را روی پد شیب‌دار بگذارید و دمبل یا دسته‌ها را با دست‌های صاف بگیرید.
اجرا: آرنج‌ها را به عقب و بالا بکشید تا کتف‌ها به هم برسند و آرام برگردید.
نکته: چون فشاری به کمر نمی‌آید، برای حجم‌دادن به میانهٔ پشت بسیار مناسب است.
عضلات کمکی: دوسر بازو و دلتوئید پشتی.', 'پشت', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Chest-Supported Row' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'رک پول', 'Rack Pull', 'آماده‌سازی: هالتر را روی پایه‌ها در سطح زانو بگذارید، پاها به‌اندازهٔ عرض لگن، کمر صاف.
اجرا: با فشار پاها و باز کردن لگن بایستید و شانه‌ها را کمی عقب بدهید، سپس هالتر را کنترل‌شده برگردانید.
نکته: نوعی ددلیفت با دامنهٔ کوتاه برای تقویت قسمت بالای پشت و گرفت است.
عضلات کمکی: باسن، همسترینگ، ذوزنقه و ساعد.', 'پشت', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Rack Pull' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'بک اکستنشن', 'Back Extension', 'آماده‌سازی: روی دستگاه هیپر اکستنشن، لگن را روی پد بگذارید و بدن را صاف نگه دارید.
اجرا: از ناحیهٔ لگن به پایین خم شوید و سپس با انقباض کمر و باسن بدن را تا حالت صاف بالا بیاورید.
نکته: بیش از حد به عقب خم نشوید؛ برای سخت‌تر شدن یک صفحهٔ وزنه روی سینه بگیرید.
عضلات کمکی: باسن و همسترینگ.', 'پشت', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Back Extension' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'اسکات جلو با هالتر', 'Front Squat', 'آماده‌سازی: هالتر را روی دلتوئید جلویی و ترقوه بگذارید، آرنج‌ها بالا و سینه صاف.
اجرا: تا موازی یا کمی پایین‌تر از موازی بنشینید و با فشار روی پاشنه بایستید.
نکته: فشار بیشتری روی چهارسر ران می‌آورد و کمر را کمتر درگیر می‌کند؛ اگر مچ‌ها انعطاف ندارند از کفش با پاشنهٔ کوتاه کمک بگیرید.
عضلات کمکی: باسن، شکم و کمر.', 'پا', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Front Squat' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'اسکات گابلت', 'Goblet Squat', 'آماده‌سازی: یک دمبل یا کتل‌بل را عمودی جلوی سینه نگه دارید و پاها را کمی بازتر از شانه بگذارید.
اجرا: با صاف نگه داشتن کمر پایین بنشینید تا آرنج‌ها داخل زانوها قرار بگیرند و بالا بیایید.
نکته: برای یادگیری الگوی اسکات و گرم‌کردن عالی است؛ زانوها همراستای پنجه بمانند.
عضلات کمکی: باسن، شکم و ساعد.', 'پا', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Goblet Squat' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'اسکات بلغاری', 'Bulgarian Split Squat', 'آماده‌سازی: پای عقب را روی نیمکت بگذارید و پای جلو را یک قدم دورتر از آن قرار دهید.
اجرا: با خم‌کردن زانوی جلو پایین بروید تا ران تقریباً موازی زمین شود و با فشار پاشنه بالا بیایید.
نکته: تنه را کمی جلو بدهید تا باسن بیشتر درگیر شود؛ برای تعادل بهتر می‌توانید دمبل در دست بگیرید.
عضلات کمکی: باسن، همسترینگ و شکم.', 'پا', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Bulgarian Split Squat' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'هاک اسکات', 'Hack Squat', 'آماده‌سازی: پشت و باسن را به تکیه‌گاه دستگاه بچسبانید و پاها را روی سکو کمی جلوتر از شانه بگذارید.
اجرا: با کنترل پایین بروید تا زانوها حدود ۹۰ درجه خم شوند و با فشار پاها بالا بیایید.
نکته: چهارسر ران را به‌خوبی ایزوله می‌کند؛ زانوها را در بالا قفل نکنید.
عضلات کمکی: باسن.', 'پا', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Hack Squat' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'ددلیفت سومو', 'Sumo Deadlift', 'آماده‌سازی: پاها را خیلی بازتر از شانه بگذارید با پنجه‌های رو به بیرون و هالتر را با دست‌های بین پاها بگیرید.
اجرا: با فشار پاها به زمین و باز کردن لگن بایستید و هالتر را نزدیک بدن نگه دارید.
نکته: کمر باید کاملاً صاف بماند؛ نسبت به ددلیفت معمولی فشار کمتری به کمر می‌آورد و داخل ران را بیشتر درگیر می‌کند.
عضلات کمکی: باسن، پشت و ساعد.', 'پا', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Sumo Deadlift' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'لانگز راه‌رفتنی', 'Walking Lunge', 'آماده‌سازی: با دمبل در دو دست یا بدون وزنه بایستید.
اجرا: یک قدم بلند به جلو بردارید، زانوی عقب را تا نزدیک زمین پایین ببرید و با پای جلو بایستید و قدم بعدی را بردارید.
نکته: گام‌ها را به‌اندازهٔ کافی بلند بردارید تا زانو از مچ جلوتر نرود؛ تنه صاف باشد.
عضلات کمکی: باسن، همسترینگ و شکم.', 'پا', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Walking Lunge' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'استپ‌آپ', 'Step-Up', 'آماده‌سازی: روبه‌روی یک جعبه یا نیمکت هم‌ارتفاع زانو بایستید و دمبل در دست بگیرید.
اجرا: یک پا را روی جعبه بگذارید، با فشار همان پا بالا بروید و آرام پایین بیایید.
نکته: پای پشتی کمک نکند؛ برای هر پا تعداد تکرار برابر انجام دهید.
عضلات کمکی: باسن و ساق.', 'پا', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Step-Up' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'گلوت بریج', 'Glute Bridge', 'آماده‌سازی: به پشت بخوابید، زانوها خم و کف پاها روی زمین، دست‌ها کنار بدن.
اجرا: با فشار پاشنه‌ها لگن را بالا ببرید تا شانه تا زانو یک خط شود، باسن را فشار دهید و آرام پایین بیایید.
نکته: کمر را بیش از حد قوس ندهید؛ می‌توانید دیسک وزنه روی لگن بگذارید.
عضلات کمکی: همسترینگ و شکم.', 'پا', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Glute Bridge' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'ساق پا با دستگاه پرس پا', 'Leg Press Calf Raise', 'آماده‌سازی: روی دستگاه پرس پا بنشینید و فقط جلوی کف پا را روی لبهٔ سکو بگذارید، زانوها تقریباً صاف.
اجرا: سکو را با باز کردن مچ‌ها تا حد ممکن بالا بفشارید، یک ثانیه بمانید و تا کشش کامل برگردید.
نکته: زانوها را در تمام حرکت ثابت نگه دارید؛ دامنهٔ کامل مهم‌تر از وزنهٔ سنگین است.
عضلات کمکی: ندارد (ایزوله).', 'ساق پا', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Leg Press Calf Raise' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'پرس سرشانه با دستگاه', 'Machine Shoulder Press', 'آماده‌سازی: صندلی را تنظیم کنید تا دسته‌ها هم‌ارتفاع شانه باشند و پشت به تکیه‌گاه بچسبد.
اجرا: دسته‌ها را بالا بفشارید تا آرنج‌ها تقریباً صاف شوند و آرام پایین بیاورید.
نکته: کمر را قوس ندهید؛ گزینهٔ امنی برای مبتدی‌ها و تکرارهای بالا است.
عضلات کمکی: سه‌سر بازو.', 'شانه', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Machine Shoulder Press' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'پرس آرنولدی', 'Arnold Press', 'آماده‌سازی: نشسته، دمبل‌ها را جلوی سینه با کف دست رو به خود نگه دارید.
اجرا: هنگام بالا بردن دمبل‌ها دست‌ها را بچرخانید تا بالا کف دست رو به جلو شود و برعکس برگردید.
نکته: وزنه را سبک‌تر از پرس معمولی انتخاب کنید؛ هر سه سر دلتوئید را درگیر می‌کند.
عضلات کمکی: سه‌سر بازو و ذوزنقه.', 'شانه', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Arnold Press' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'نشر جانب سیم‌کش', 'Cable Lateral Raise', 'آماده‌سازی: کنار قرقرهٔ پایین بایستید و دسته را با دست دورتر بگیرید.
اجرا: دست را با آرنج اندکی خم تا هم‌سطح شانه به پهلو بالا ببرید و آرام برگردید.
نکته: کشش ثابت کابل در تمام دامنه فشار را روی سر میانی دلتوئید نگه می‌دارد؛ از تاب‌دادن بدن پرهیز کنید.
عضلات کمکی: دلتوئید جلویی و ذوزنقه.', 'شانه', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Cable Lateral Raise' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'نشر خم با دستگاه (دلتوئید خلفی)', 'Reverse Pec Deck Fly', 'آماده‌سازی: روبه‌روی تکیه‌گاه دستگاه پک دک بنشینید و دسته‌ها را با دست‌های تقریباً صاف بگیرید.
اجرا: دست‌ها را به عقب و پهلو باز کنید تا کتف‌ها به هم نزدیک شوند، سپس برگردید.
نکته: وزنه سبک باشد و با آرنج حرکت کنید؛ برای اصلاح وضعیت شانه‌های گرد عالی است.
عضلات کمکی: ذوزنقه و رومبوئید.', 'شانه', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Reverse Pec Deck Fly' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'بالا کشیدن هالتر از جلو (آپرایت رو)', 'Upright Row', 'آماده‌سازی: هالتر یا هالتر EZ را با دست‌های به‌اندازهٔ عرض شانه جلوی ران‌ها بگیرید.
اجرا: آرنج‌ها را بالاتر از مچ‌ها هدایت کنید و هالتر را تا زیر چانه بکشید، سپس آرام پایین بیاورید.
نکته: برای حفظ سلامت شانه دست‌ها را بازتر بگیرید و بیش از سطح سینه بالا نروید.
عضلات کمکی: ذوزنقه و دوسر بازو.', 'شانه', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Upright Row' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'شراگ با دمبل', 'Dumbbell Shrug', 'آماده‌سازی: دو دمبل را کنار بدن با دست‌های صاف بگیرید.
اجرا: شانه‌ها را مستقیم به سمت گوش‌ها بالا بکشید، یک ثانیه نگه دارید و آرام پایین بیاورید.
نکته: شانه‌ها را نچرخانید؛ از بند مچ‌بند برای وزنه‌های سنگین کمک بگیرید.
عضلات کمکی: ساعد.', 'شانه', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Dumbbell Shrug' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'جلو بازو دمبل روی نیمکت شیب‌دار', 'Incline Dumbbell Curl', 'آماده‌سازی: روی نیمکت شیب‌دار ۶۰ درجه بنشینید و دست‌ها را پشت بدن آویزان کنید.
اجرا: دمبل‌ها را بدون حرکت‌دادن آرنج بالا بیاورید و با کنترل پایین بروید.
نکته: وضعیت کشیده بازو سر بلند دوسر را بیشتر درگیر می‌کند؛ وزنه را سبک نگه دارید.
عضلات کمکی: براکیالیس و ساعد.', 'جلو بازو', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Incline Dumbbell Curl' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'جلو بازو تمرکزی', 'Concentration Curl', 'آماده‌سازی: روی نیمکت بنشینید و پشت آرنج را به داخل ران بچسبانید.
اجرا: دمبل را بالا بیاورید تا دوسر کاملاً منقبض شود، سپس آرام پایین بروید.
نکته: بدن را تکان ندهید؛ برای ایزوله‌کردن و حس عضله مناسب است.
عضلات کمکی: براکیالیس.', 'جلو بازو', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Concentration Curl' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'جلو بازو هالتر EZ', 'EZ-Bar Curl', 'آماده‌سازی: هالتر خمیده را از قسمت شیب‌دار بگیرید و آرنج‌ها را کنار بدن بچسبانید.
اجرا: هالتر را تا سطح شانه بالا بیاورید و آرام پایین ببرید.
نکته: به‌دلیل زاویهٔ دست‌ها فشار کمتری به مچ می‌آید؛ از تکان‌دادن کمر پرهیز کنید.
عضلات کمکی: براکیالیس و ساعد.', 'جلو بازو', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'EZ-Bar Curl' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'جلو بازو اسپایدر', 'Spider Curl', 'آماده‌سازی: روی نیمکت شیب‌دار به‌صورت دمر دراز بکشید و دست‌ها را با دمبل یا هالتر پایین آویزان کنید.
اجرا: وزنه را بالا بیاورید و در بالا دوسر را منقبض کنید، سپس آرام پایین ببرید.
نکته: نبودن کمک از بدن، تمرین را ایزوله و دقیق می‌کند؛ وزنه را سبک بردارید.
عضلات کمکی: براکیالیس.', 'جلو بازو', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Spider Curl' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'پرس سینه دست جمع', 'Close-Grip Bench Press', 'آماده‌سازی: روی نیمکت صاف دراز بکشید و هالتر را به‌اندازهٔ عرض شانه (نه کمتر) بگیرید.
اجرا: هالتر را با آرنج‌های نزدیک بدن تا پایین سینه بیاورید و بالا بفشارید.
نکته: گرفتن بیش از حد باریک به مچ آسیب می‌زند؛ از بهترین حرکات حجمی برای پشت بازو است.
عضلات کمکی: سینه و دلتوئید جلویی.', 'پشت بازو', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Close-Grip Bench Press' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'پشت بازو سیم‌کش بالای سر', 'Cable Overhead Triceps Extension', 'آماده‌سازی: پشت به قرقره بایستید، طناب را با دو دست بالای سر بگیرید و آرنج‌ها را نزدیک سر نگه دارید.
اجرا: ساعدها را به جلو باز کنید تا دست‌ها صاف شوند و آرام برگردید.
نکته: سر بلند سه‌سر را در حالت کشیده درگیر می‌کند؛ آرنج‌ها بیرون نزنند.
عضلات کمکی: ندارد (ایزوله).', 'پشت بازو', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Cable Overhead Triceps Extension' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'پشت بازو سیم‌کش طناب', 'Rope Pushdown', 'آماده‌سازی: جلوی قرقرهٔ بالا بایستید، طناب را بگیرید و آرنج‌ها را به پهلو بچسبانید.
اجرا: طناب را پایین بکشید و در انتها دو سر طناب را به بیرون باز کنید تا پشت بازو منقبض شود، سپس برگردید.
نکته: شانه‌ها را بالا نیاورید و فقط آرنج را حرکت دهید.
عضلات کمکی: ندارد (ایزوله).', 'پشت بازو', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Rope Pushdown' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'دیپ نیمکت', 'Bench Dip', 'آماده‌سازی: دست‌ها را پشت بدن روی لبهٔ نیمکت بگذارید و پاها را جلو دراز کنید.
اجرا: آرنج‌ها را به عقب خم کنید و بدن را پایین ببرید تا بازو حدود ۹۰ درجه شود، سپس بالا بیایید.
نکته: بدن نزدیک نیمکت بماند و شانه‌ها بالا نروند؛ برای سخت‌تر شدن پاها را روی نیمکت دیگر بگذارید.
عضلات کمکی: دلتوئید جلویی و سینه.', 'پشت بازو', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Bench Dip' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'خم‌کردن مچ با هالتر', 'Barbell Wrist Curl', 'آماده‌سازی: ساعدها را روی ران یا نیمکت بگذارید و هالتر را با کف دست رو به بالا بگیرید.
اجرا: فقط با مچ هالتر را بالا بیاورید و آرام پایین بروید تا انگشتان باز شوند.
نکته: وزنه سبک و تکرار بالا (۱۵ تا ۲۰) مناسب ساعد است؛ ساعد را از نیمکت بلند نکنید.
عضلات کمکی: ندارد (ایزوله).', 'ساعد', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Barbell Wrist Curl' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'جلو بازو معکوس', 'Reverse Curl', 'آماده‌سازی: هالتر را با کف دست رو به پایین بگیرید و آرنج‌ها را کنار بدن نگه دارید.
اجرا: هالتر را تا سطح شانه بالا بیاورید و آرام پایین ببرید.
نکته: ساعد و براکیورادیالیس را قوی می‌کند؛ وزنه را نسبت به جلو بازو معمولی کمتر بردارید.
عضلات کمکی: دوسر بازو و براکیالیس.', 'ساعد', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Reverse Curl' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'کرانچ دوچرخه', 'Bicycle Crunch', 'آماده‌سازی: به پشت بخوابید، دست‌ها پشت سر و پاها کمی از زمین بالا.
اجرا: آرنج مخالف را به زانوی طرف دیگر نزدیک کنید و هم‌زمان پای دیگر را دراز کنید؛ به‌صورت متناوب ادامه دهید.
نکته: حرکت را آرام انجام دهید و گردن را نکشید؛ شکم و عضلات مایل را درگیر می‌کند.
عضلات کمکی: عضلات مایل و فلکسور لگن.', 'شکم', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Bicycle Crunch' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'چرخ شکم', 'Ab Wheel Rollout', 'آماده‌سازی: روی زانو بایستید و چرخ را با دو دست زیر شانه‌ها بگیرید، کمر کمی گرد.
اجرا: چرخ را به جلو بغلتانید تا بدن تقریباً صاف شود و با انقباض شکم برگردید.
نکته: اجازه ندهید کمر گود شود؛ مبتدی‌ها دامنه را کوتاه نگه دارند.
عضلات کمکی: دلتوئید، لَت و سه‌سر بازو.', 'شکم', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Ab Wheel Rollout' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'پلانک جانبی', 'Side Plank', 'آماده‌سازی: به پهلو بخوابید و روی ساعد تکیه کنید، آرنج زیر شانه.
اجرا: لگن را از زمین بلند کنید تا بدن یک خط صاف شود و ۳۰ تا ۶۰ ثانیه نگه دارید.
نکته: لگن نیفتد و بدن به جلو یا عقب نچرخد؛ برای هر طرف تکرار کنید.
عضلات کمکی: عضلات مایل، باسن و شانه.', 'شکم', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Side Plank' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'بالا آوردن پا خوابیده', 'Lying Leg Raise', 'آماده‌سازی: به پشت بخوابید و دست‌ها را زیر باسن یا کنار بدن بگذارید.
اجرا: پاهای صاف را تا ۹۰ درجه بالا بیاورید و آرام تا نزدیک زمین پایین ببرید.
نکته: کمر را به زمین بچسبانید؛ اگر کمر بلند شد زانوها را کمی خم کنید.
عضلات کمکی: فلکسور لگن.', 'شکم', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Lying Leg Raise' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'کوهنورد', 'Mountain Climber', 'آماده‌سازی: در وضعیت شنا با دست‌های صاف و بدن مستقیم قرار بگیرید.
اجرا: زانوها را به‌صورت متناوب و سریع به سمت سینه بیاورید.
نکته: لگن بالا نرود؛ سرعت را برای تمرین کاردیو بالا و برای تمرین شکم کنترل‌شده نگه دارید.
عضلات کمکی: شانه، سینه و فلکسور لگن.', 'شکم', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Mountain Climber' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'روئینگ', 'Rowing Machine', 'آماده‌سازی: روی دستگاه بنشینید، پاها را روی پدال ببندید و دسته را بگیرید.
اجرا: با فشار پاها شروع کنید، سپس تنه را عقب ببرید و دسته را به شکم بکشید؛ به همان ترتیب برگردید.
نکته: توالی حرکت پا، تنه و دست را رعایت کنید؛ تمرین کاردیو کم‌فشار برای کل بدن است.
عضلات کمکی: پشت، پا و دوسر بازو.', 'کاردیو', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Rowing Machine' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'پله‌نورد (استیرمستر)', 'Stair Climber', 'آماده‌سازی: روی دستگاه بایستید و دست‌ها را سبک روی نرده بگذارید.
اجرا: با سرعت دلخواه مثل بالا رفتن از پله قدم بردارید و بدن را صاف نگه دارید.
نکته: به نرده تکیه نکنید؛ برای سوخت چربی و تقویت پا مناسب است.
عضلات کمکی: باسن، چهارسر ران و ساق.', 'کاردیو', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Stair Climber' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'برپی', 'Burpee', 'آماده‌سازی: ایستاده شروع کنید.
اجرا: بنشینید، دست‌ها را روی زمین بگذارید، پاها را عقب بپرانید تا وضعیت شنا شود، یک شنا بزنید، پاها را برگردانید و با پرش بایستید.
نکته: برای مبتدی‌ها شنا و پرش را حذف کنید؛ تمرین شدید برای کل بدن است.
عضلات کمکی: سینه، شانه، پا و شکم.', 'کاردیو', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Burpee' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'کتل‌بل سوئینگ', 'Kettlebell Swing', 'آماده‌سازی: پاها بازتر از شانه، کتل‌بل را با دو دست از دسته بگیرید و کمی به جلو خم شوید.
اجرا: با باز کردن سریع لگن، کتل‌بل را تا سطح سینه به جلو پرتاب کنید و بگذارید به‌طور کنترل‌شده برگردد.
نکته: حرکت از لگن است نه از دست‌ها؛ کمر را صاف نگه دارید.
عضلات کمکی: باسن، همسترینگ، کمر و شانه.', 'تمام بدن', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Kettlebell Swing' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'راه رفتن کشاورز', 'Farmers Walk', 'آماده‌سازی: دو دمبل یا کتل‌بل سنگین بردارید و قامت را صاف نگه دارید.
اجرا: با گام‌های کوتاه و کنترل‌شده ۲۰ تا ۴۰ متر راه بروید.
نکته: شانه‌ها را عقب و شکم را سفت نگه دارید؛ گرفت و ثبات مرکزی بدن را تقویت می‌کند.
عضلات کمکی: ساعد، ذوزنقه، شکم و پا.', 'تمام بدن', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Farmers Walk' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'تراستر', 'Thruster', 'آماده‌سازی: هالتر یا دمبل‌ها را در وضعیت جلو شانه (فرانت رک) نگه دارید.
اجرا: یک اسکات عمیق انجام دهید و هنگام بالا آمدن وزنه را بالای سر بفشارید.
نکته: حرکت باید پیوسته و روان باشد؛ وزنهٔ سبک تا متوسط انتخاب کنید.
عضلات کمکی: چهارسر ران، باسن، شانه و سه‌سر بازو.', 'تمام بدن', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Thruster' AND created_by IS NULL);
INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
SELECT UUID(), 'پاورکلین', 'Power Clean', 'آماده‌سازی: هالتر را از زمین با کمر صاف و دست‌های بیرون زانو بگیرید.
اجرا: با فشار پاها و باز کردن انفجاری لگن هالتر را بالا بکشید و زیر آن بنشینید تا روی شانه‌ها بنشیند.
نکته: تکنیک بسیار مهم است؛ ابتدا با وزنه خیلی سبک و زیر نظر مربی تمرین کنید.
عضلات کمکی: ذوزنقه، باسن، همسترینگ و شانه.', 'تمام بدن', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name_en = 'Power Clean' AND created_by IS NULL);

-- ===== Foods (50) =====
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'گوشت چرخ‌کرده کم‌چرب پخته', 'Cooked Lean Ground Beef', 'پروتئین و آهن بالا؛ بهتر است گوشت با چربی کمتر از ۱۰٪ تهیه شود و بدون روغن اضافه پخته شود. مقادیر برای گوشت پخته است.', 'منابع پروتئینی', 'گرم', 2.17, 0.261, 0, 0.117, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Cooked Lean Ground Beef' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'جگر گوساله پخته', 'Cooked Beef Liver', 'منبع بسیار غنی ویتامین A، B12 و آهن؛ ۱ تا ۲ بار در هفته و در مقدار کم مصرف شود. مقادیر برای جگر پخته است.', 'منابع پروتئینی', 'گرم', 1.75, 0.267, 0.039, 0.047, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Cooked Beef Liver' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'جگر مرغ پخته', 'Cooked Chicken Liver', 'پروتئین و ویتامین B12 و آهن بالا با قیمت مناسب؛ مصرف هفتگی محدود توصیه می‌شود. مقادیر برای جگر پخته است.', 'منابع پروتئینی', 'گرم', 1.67, 0.245, 0.009, 0.065, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Cooked Chicken Liver' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'ساق مرغ بدون پوست پخته', 'Cooked Skinless Chicken Drumstick', 'جایگزین ارزان‌تر و آبدارتر سینه مرغ با چربی کم؛ پوست آن قبل از پخت جدا شود. مقادیر برای گوشت پخته بدون استخوان است.', 'منابع پروتئینی', 'گرم', 1.55, 0.242, 0, 0.057, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Cooked Skinless Chicken Drumstick' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'ماهی خال‌مخالی (ماکرل) پخته', 'Cooked Mackerel', 'منبع عالی چربی‌های امگا ۳؛ کالری بیشتری نسبت به ماهی‌های سفید دارد و برای دوره حجم مناسب است. مقادیر برای ماهی پخته است.', 'منابع پروتئینی', 'گرم', 2.62, 0.239, 0, 0.179, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Cooked Mackerel' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'ساردین کنسرو آب‌چکان‌شده', 'Canned Sardines Drained', 'پروتئین، امگا ۳ و کلسیم (در صورت مصرف استخوان نرم)؛ آماده مصرف و مقرون‌به‌صرفه. مقادیر برای نوع کنسرو شده در روغن و آب‌چکان‌شده است.', 'منابع پروتئینی', 'گرم', 2.08, 0.246, 0, 0.115, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Canned Sardines Drained' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'فیله ماهی کاد پخته', 'Cooked Cod Fillet', 'پروتئین بالا و چربی بسیار کم؛ گزینه‌ای ایده‌آل برای دوره کات. مقادیر برای ماهی پخته است.', 'منابع پروتئینی', 'گرم', 1.05, 0.228, 0, 0.009, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Cooked Cod Fillet' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'ماهی تیلاپیا پخته', 'Cooked Tilapia', 'ماهی سفید کم‌چرب و ارزان با پروتئین بالا. مقادیر برای ماهی پخته است.', 'منابع پروتئینی', 'گرم', 1.28, 0.262, 0, 0.027, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Cooked Tilapia' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'توفو', 'Firm Tofu', 'منبع پروتئین گیاهی کامل برای گیاه‌خواران؛ حاوی کلسیم و آهن. مقادیر برای توفوی سفت است.', 'منابع پروتئینی', 'گرم', 1.44, 0.173, 0.028, 0.087, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Firm Tofu' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'تمپه', 'Tempeh', 'سویای تخمیر‌شده با پروتئین و فیبر بالا؛ برای گوارش بهتر از سویای معمولی است.', 'منابع پروتئینی', 'گرم', 1.92, 0.203, 0.076, 0.108, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Tempeh' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'بلغور پخته', 'Cooked Bulgur', 'غلات سبوس‌دار با فیبر بالا و شاخص گلیسمی پایین. مقادیر برای بلغور پخته است.', 'کربوهیدرات و غلات', 'گرم', 0.83, 0.031, 0.186, 0.002, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Cooked Bulgur' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'کوسکوس پخته', 'Cooked Couscous', 'کربوهیدرات سریع‌پخت و سبک؛ مناسب وعده‌های قبل از تمرین. مقادیر برای کوسکوس پخته است.', 'کربوهیدرات و غلات', 'گرم', 1.12, 0.038, 0.232, 0.002, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Cooked Couscous' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'نان تمام گندم', 'Whole Wheat Bread Slice', 'فیبر بیشتر و سیری طولانی‌تر نسبت به نان سفید. هر برش حدود ۲۸ گرم فرض شده است.', 'کربوهیدرات و غلات', 'برش', 69.16, 3.64, 11.564, 0.952, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Whole Wheat Bread Slice' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'نان لواش', 'Lavash Bread', 'نان نازک و پرمصرف ایرانی؛ بر حسب گرم وزن کنید چون اندازهٔ نان‌ها متفاوت است.', 'کربوهیدرات و غلات', 'گرم', 2.75, 0.091, 0.565, 0.012, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Lavash Bread' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'کیک برنجی', 'Rice Cake', 'میان‌وعدهٔ سبک و کم‌چرب با کربوهیدرات سریع؛ هر عدد حدود ۹ گرم فرض شده است.', 'کربوهیدرات و غلات', 'عدد', 34.83, 0.738, 7.335, 0.252, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Rice Cake' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'ماکارونی تمام گندم پخته', 'Cooked Whole Wheat Pasta', 'فیبر و ریزمغذی بیشتر از ماکارونی معمولی. مقادیر برای ماکارونی پخته است.', 'کربوهیدرات و غلات', 'گرم', 1.24, 0.053, 0.265, 0.005, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Cooked Whole Wheat Pasta' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'جو پرک پخته', 'Cooked Pearl Barley', 'منبع فیبر محلول (بتاگلوکان) که به سلامت قلب و قند خون کمک می‌کند. مقادیر برای جو پخته است.', 'کربوهیدرات و غلات', 'گرم', 1.23, 0.023, 0.282, 0.004, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Cooked Pearl Barley' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'گندم سیاه پخته', 'Cooked Buckwheat', 'بدون گلوتن، با پروتئین و منیزیم مناسب. مقادیر برای گندم سیاه پخته است.', 'کربوهیدرات و غلات', 'گرم', 0.92, 0.034, 0.199, 0.006, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Cooked Buckwheat' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'ماش پخته', 'Cooked Mung Beans', 'حبوبات سبک و پرفیبر با پروتئین گیاهی خوب. مقادیر برای ماش پخته است.', 'حبوبات', 'گرم', 1.05, 0.07, 0.192, 0.004, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Cooked Mung Beans' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'لوبیا سیاه پخته', 'Cooked Black Beans', 'پروتئین و فیبر بالا و کربوهیدرات کند‌جذب. مقادیر برای لوبیای پخته است.', 'حبوبات', 'گرم', 1.32, 0.089, 0.237, 0.005, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Cooked Black Beans' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'سویای سبز (ادامامه) پخته', 'Cooked Edamame', 'میان‌وعدهٔ پرپروتئین گیاهی با فیبر و فولات. مقادیر برای ادامه پخته است.', 'حبوبات', 'گرم', 1.21, 0.119, 0.089, 0.052, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Cooked Edamame' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'باقالا پخته', 'Cooked Fava Beans', 'حبوبات پرپروتئین و پرفیبر؛ افراد مبتلا به فاویسم باید از آن دوری کنند. مقادیر برای باقالای پخته است.', 'حبوبات', 'گرم', 1.1, 0.076, 0.197, 0.004, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Cooked Fava Beans' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'پنیر کاتیج کم‌چرب', 'Low-Fat Cottage Cheese', 'پروتئین کازئین کندجذب با چربی کم؛ برای قبل از خواب مناسب است.', 'لبنیات', 'گرم', 0.72, 0.124, 0.027, 0.01, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Low-Fat Cottage Cheese' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'پنیر فتا', 'Feta Cheese', 'پنیر سفید پرچرب و پرنمک؛ در رژیم کم‌سدیم و کات به مقدار کم استفاده شود.', 'لبنیات', 'گرم', 2.64, 0.142, 0.041, 0.213, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Feta Cheese' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'کفیر کم‌چرب', 'Low-Fat Kefir', 'نوشیدنی تخمیری حاوی پروبیوتیک؛ برای سلامت گوارش مفید است.', 'لبنیات', 'گرم', 0.4, 0.034, 0.048, 0.01, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Low-Fat Kefir' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'پنیر موزارلا نیمه‌چرب', 'Part-Skim Mozzarella', 'پنیر پرپروتئین با چربی متوسط؛ برای ساندویچ و املت مناسب است.', 'لبنیات', 'گرم', 2.54, 0.243, 0.028, 0.159, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Part-Skim Mozzarella' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'شیر پرچرب', 'Whole Milk', 'کالری و چربی بیشتر نسبت به شیر کم‌چرب؛ برای افزایش وزن مناسب‌تر است. هر لیوان حدود ۲۴۴ گرم فرض شده است.', 'لبنیات', 'لیوان', 148.84, 7.808, 11.712, 8.052, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Whole Milk' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'گل‌کلم', 'Cauliflower', 'کم‌کالری و پرحجم؛ جایگزین خوب برنج یا پوره در دوره کات.', 'سبزیجات', 'گرم', 0.25, 0.019, 0.05, 0.003, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Cauliflower' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'کلم سفید', 'Cabbage', 'فیبر بالا و کالری بسیار کم؛ برای سالاد و آبگوشت مناسب است.', 'سبزیجات', 'گرم', 0.25, 0.013, 0.058, 0.001, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Cabbage' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'بادمجان', 'Eggplant', 'کم‌کالری؛ به‌شرط کباب یا بخارپز شدن و جذب‌نکردن روغن زیاد. مقادیر برای نوع خام است.', 'سبزیجات', 'گرم', 0.25, 0.01, 0.059, 0.002, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Eggplant' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'قارچ', 'White Mushroom', 'کم‌کالری با پروتئین نسبتاً خوب؛ منبع ویتامین‌های گروه B.', 'سبزیجات', 'گرم', 0.22, 0.031, 0.033, 0.003, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'White Mushroom' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'لوبیا سبز پخته', 'Cooked Green Beans', 'سبزی کم‌کالری با فیبر و ویتامین K. مقادیر برای لوبیای پخته است.', 'سبزیجات', 'گرم', 0.35, 0.019, 0.079, 0.003, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Cooked Green Beans' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'چغندر پخته', 'Cooked Beetroot', 'منبع نیترات طبیعی که ممکن است عملکرد ورزشی را بهبود دهد. مقادیر برای چغندر پخته است.', 'سبزیجات', 'گرم', 0.44, 0.017, 0.1, 0.002, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Cooked Beetroot' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'انار', 'Pomegranate Arils', 'پرآنتی‌اکسیدان و محبوب ایرانی؛ مقادیر برای دانهٔ انار (بدون پوست) است.', 'میوه‌ها', 'گرم', 0.83, 0.017, 0.187, 0.012, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Pomegranate Arils' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'گلابی', 'Pear', 'فیبر بالا و سیرکننده. هر عدد متوسط حدود ۱۷۸ گرم فرض شده است.', 'میوه‌ها', 'عدد', 101.46, 0.712, 27.056, 0.178, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Pear' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'هلو', 'Peach', 'میوه آبدار و کم‌کالری. هر عدد متوسط حدود ۱۵۰ گرم فرض شده است.', 'میوه‌ها', 'عدد', 58.5, 1.35, 14.25, 0.45, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Peach' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'انبه', 'Mango', 'منبع ویتامین C و A؛ قند بالاتری دارد و در دوره کات به مقدار کم مصرف شود.', 'میوه‌ها', 'گرم', 0.6, 0.008, 0.15, 0.004, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Mango' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'کشمش', 'Raisins', 'کربوهیدرات سریع‌جذب و پرانرژی؛ برای قبل از تمرین یا حجم مناسب است.', 'میوه‌ها', 'گرم', 2.99, 0.031, 0.792, 0.005, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Raisins' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'خربزه', 'Cantaloupe Melon', 'میوه‌ای کم‌کالری و آبدار؛ منبع ویتامین A و C.', 'میوه‌ها', 'گرم', 0.34, 0.008, 0.082, 0.002, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Cantaloupe Melon' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'زردآلو خشک', 'Dried Apricot', 'پتاسیم و فیبر بالا؛ کالری متراکم دارد و مقدار مصرف آن را محدود کنید.', 'میوه‌ها', 'گرم', 2.41, 0.034, 0.626, 0.005, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Dried Apricot' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'بادام هندی (کاشو)', 'Cashews', 'چربی سالم و منیزیم؛ کالری بسیار بالا دارد و باید وزن شود.', 'چربی‌های سالم', 'گرم', 5.53, 0.182, 0.302, 0.438, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Cashews' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'فندق', 'Hazelnuts', 'منبع ویتامین E و چربی تک‌غیراشباع؛ مصرف مشتی در حد ۳۰ گرم کافی است.', 'چربی‌های سالم', 'گرم', 6.28, 0.15, 0.167, 0.608, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Hazelnuts' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'دانه کتان آسیاب‌شده', 'Ground Flaxseed', 'منبع امگا ۳ گیاهی و فیبر؛ برای جذب بهتر آسیاب‌شده مصرف شود. هر قاشق حدود ۱۰ گرم فرض شده است.', 'چربی‌های سالم', 'قاشق غذاخوری', 53.4, 1.83, 2.89, 4.22, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Ground Flaxseed' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'ارده', 'Tahini', 'خمیر کنجد با چربی سالم و کلسیم؛ کالری بالایی دارد. هر قاشق حدود ۱۵ گرم فرض شده است.', 'چربی‌های سالم', 'قاشق غذاخوری', 89.25, 2.55, 3.18, 8.07, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Tahini' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'شیر بادام بدون شکر', 'Unsweetened Almond Milk', 'جایگزین کم‌کالری شیر؛ پروتئین کمی دارد. هر لیوان حدود ۲۴۰ گرم فرض شده است.', 'نوشیدنی‌ها', 'لیوان', 31.2, 0.96, 0.96, 2.64, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Unsweetened Almond Milk' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'آب نارگیل', 'Coconut Water', 'منبع طبیعی پتاسیم و الکترولیت؛ مناسب بعد از تمرین سبک. هر لیوان حدود ۲۴۰ گرم فرض شده است.', 'نوشیدنی‌ها', 'لیوان', 45.6, 1.68, 8.88, 0.48, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Coconut Water' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'عسل', 'Honey', 'قند طبیعی سریع‌جذب؛ در مقدار کم قبل یا بعد از تمرین. هر قاشق حدود ۲۱ گرم فرض شده است.', 'میان‌وعده و شیرینی', 'قاشق غذاخوری', 63.84, 0.063, 17.304, 0, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Honey' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'شکلات تلخ ۷۰٪', 'Dark Chocolate 70%', 'آنتی‌اکسیدان و منیزیم؛ پرکالری است و باید به مقدار کم مصرف شود.', 'میان‌وعده و شیرینی', 'گرم', 5.98, 0.078, 0.459, 0.426, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Dark Chocolate 70%' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'حمص', 'Hummus', 'ترکیب نخود و ارده؛ میان‌وعدهٔ مغذی که باید با مقدار آن حساب شود.', 'میان‌وعده و شیرینی', 'گرم', 1.66, 0.079, 0.143, 0.096, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Hummus' AND created_by IS NULL);
INSERT INTO foods (id, name, name_en, description, category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g, created_by)
SELECT UUID(), 'پاپ‌کورن بدون روغن', 'Air-Popped Popcorn', 'میان‌وعدهٔ حجیم با فیبر؛ نوع با روغن و کره کالری بسیار بیشتری دارد.', 'میان‌وعده و شیرینی', 'گرم', 3.87, 0.129, 0.778, 0.045, NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_en = 'Air-Popped Popcorn' AND created_by IS NULL);

-- ===== Supplements (20) =====
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'پروتئین وی ایزوله', 'Whey Isolate', 'پروتئین وی با فیلتراسیون بیشتر؛ چربی و لاکتوز کمتر و پروتئین حدود ۹۰٪ یا بیشتر. معمولاً ۲۰ تا ۳۰ گرم بعد از تمرین یا بین وعده‌ها؛ برای افراد حساس به لاکتوز مناسب‌تر از وی معمولی است.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Whey Isolate' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'پروتئین گیاهی', 'Plant-Based Protein', 'ترکیب پروتئین نخود، برنج یا سویا برای گیاه‌خواران و افراد حساس به لبنیات. معمولاً ۲۰ تا ۳۰ گرم در روز؛ ترکیب چند منبع پروفایل آمینواسیدی کامل‌تری می‌دهد.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Plant-Based Protein' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'کراتین هیدروکلراید', 'Creatine HCl', 'شکل محلول‌تر کراتین که برخی افراد را کمتر دچار نفخ می‌کند. معمولاً ۱ تا ۲ گرم در روز؛ شواهد علمی آن به اندازهٔ کراتین مونوهیدرات نیست.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Creatine HCl' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'تائورین', 'Taurine', 'آمینواسید مرتبط با آبرسانی سلول و کاهش خستگی. معمولاً ۱ تا ۳ گرم در روز، اغلب قبل از تمرین؛ در ترکیب بسیاری از پیش‌تمرین‌ها وجود دارد.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Taurine' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'ال‌آرژنین', 'L-Arginine', 'پیش‌ساز نیتریک اکسید برای افزایش جریان خون؛ شواهد برای عملکرد ورزشی ضعیف است. معمولاً ۳ تا ۶ گرم قبل از تمرین؛ مقدار زیاد ممکن است باعث ناراحتی گوارشی شود.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'L-Arginine' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'بتائین (تری‌متیل‌گلیسین)', 'Betaine (TMG)', 'مکمل مرتبط با توان و استقامت عضلانی. معمولاً ۲.۵ گرم در روز؛ تقسیم به دو وعده و مصرف همراه غذا توصیه می‌شود.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Betaine (TMG)' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'عصاره چغندر (نیترات)', 'Beetroot Extract', 'منبع نیترات برای بهبود جریان خون و استقامت. معمولاً ۲ تا ۳ ساعت قبل از تمرین (حدود ۵۰۰ میلی‌گرم نیترات)؛ ممکن است ادرار و مدفوع را صورتی کند که بی‌خطر است.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Beetroot Extract' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'ویتامین K2', 'Vitamin K2', 'ویتامین محلول در چربی که به هدایت کلسیم به استخوان کمک می‌کند. معمولاً ۹۰ تا ۱۲۰ میکروگرم در روز همراه غذای چرب؛ افراد مصرف‌کنندهٔ داروی ضدانعقاد باید با پزشک مشورت کنند.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Vitamin K2' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'ویتامین‌های گروه ب (ب کمپلکس)', 'Vitamin B Complex', 'مجموعه ویتامین‌های ب برای متابولیسم انرژی. معمولاً یک عدد در روز همراه صبحانه؛ مصرف شبانه ممکن است خواب را مختل کند.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Vitamin B Complex' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'کورکومین (زردچوبه)', 'Curcumin', 'ماده فعال زردچوبه با خاصیت ضدالتهاب برای ریکاوری و مفاصل. معمولاً ۵۰۰ تا ۱۰۰۰ میلی‌گرم در روز، ترجیحاً همراه فلفل سیاه (پیپرین) برای جذب بهتر و با غذا.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Curcumin' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'کوآنزیم کیوتن', 'Coenzyme Q10', 'ماده‌ای مرتبط با تولید انرژی سلولی و سلامت قلب. معمولاً ۱۰۰ تا ۲۰۰ میلی‌گرم در روز همراه وعدهٔ چرب؛ در مصرف داروهای فشار خون با پزشک مشورت شود.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Coenzyme Q10' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'ام‌اس‌ام', 'MSM', 'ترکیب گوگردی برای حمایت از مفاصل و کاهش درد عضلانی. معمولاً ۱ تا ۳ گرم در روز همراه غذا؛ اغلب در ترکیب با گلوکوزامین استفاده می‌شود.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'MSM' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'فیبر پسیلیوم', 'Psyllium Husk Fiber', 'فیبر محلول برای سیری و سلامت گوارش. معمولاً ۵ تا ۱۰ گرم در روز با یک لیوان بزرگ آب؛ بدون آب کافی مصرف نکنید و فاصله آن را با داروها رعایت کنید.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Psyllium Husk Fiber' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'عصاره چای سبز', 'Green Tea Extract', 'حاوی کاتچین و کمی کافئین، گاهی در محصولات چربی‌سوز. معمولاً ۲۵۰ تا ۵۰۰ میلی‌گرم در روز همراه غذا؛ مصرف زیاد با معده خالی می‌تواند به کبد آسیب بزند.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Green Tea Extract' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'سی‌ال‌ای', 'CLA', 'اسید چرب موجود در لبنیات پرچرب که گاهی برای کاهش چربی استفاده می‌شود؛ اثر آن محدود است. معمولاً ۳ تا ۴ گرم در روز همراه غذا؛ ممکن است باعث ناراحتی گوارشی شود.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'CLA' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'ال‌تآنین', 'L-Theanine', 'آمینواسید چای که به آرامش و تمرکز کمک می‌کند. معمولاً ۱۰۰ تا ۲۰۰ میلی‌گرم، اغلب همراه کافئین برای تعدیل عصبی‌بودن؛ برای خواب شب نیز قابل استفاده است.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'L-Theanine' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'عصاره آلبالو (تارت چری)', 'Tart Cherry Extract', 'منبع آنتی‌اکسیدان برای کاهش درد عضلانی و کمک به خواب. معمولاً ۴۰۰ تا ۵۰۰ میلی‌گرم عصاره یا ۳۰ میلی‌لیتر کنسانتره، بعد از تمرین یا شب.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Tart Cherry Extract' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'دکستروز', 'Dextrose', 'قند ساده و سریع‌الجذب (پودر کربوهیدرات) برای تکمیل ذخایر گلیکوژن. معمولاً ۲۵ تا ۵۰ گرم همراه پروتئین بعد از تمرین سنگین؛ برای افراد دیابتی یا در رژیم کات مناسب نیست.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Dextrose' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'آلفا جی‌پی‌سی', 'Alpha-GPC', 'ماده مرتبط با تمرکز و توان انفجاری. معمولاً ۳۰۰ تا ۶۰۰ میلی‌گرم قبل از تمرین؛ مصرف همراه داروهای فشار خون با پزشک مشورت شود.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Alpha-GPC' AND created_by IS NULL);
INSERT INTO supplements (id, name, name_en, description, created_by)
SELECT UUID(), 'رودیولا', 'Rhodiola Rosea', 'گیاه تطبیق‌دهندهٔ استرس برای کاهش خستگی. معمولاً ۲۰۰ تا ۴۰۰ میلی‌گرم در روز صبح؛ نزدیک خواب مصرف نشود چون ممکن است تحریک‌کننده باشد.', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM supplements WHERE name_en = 'Rhodiola Rosea' AND created_by IS NULL);

-- Check: each should be 50 / 50 / 20 or more once this has run.
SELECT
  (SELECT COUNT(*) FROM exercises   WHERE created_by IS NULL) AS exercise_presets,
  (SELECT COUNT(*) FROM foods       WHERE created_by IS NULL) AS food_presets,
  (SELECT COUNT(*) FROM supplements WHERE created_by IS NULL) AS supplement_presets;
