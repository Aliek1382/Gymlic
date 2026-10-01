-- Descriptions for the original preset exercises and foods, which were seeded
-- without any. Same style as library-extra-update.sql: exercises get setup,
-- execution, tip and secondary muscles; foods get a short note (and the portion
-- weight behind per-piece units).
-- Run from the admin panel's database page, or in phpMyAdmin -> SQL after taking
-- a backup. Only presets (created_by IS NULL) whose description is still empty are
-- filled, matched on the English name, so anything edited by an admin is never
-- overwritten and running it twice is harmless. No schema change.

SET NAMES utf8mb4;

-- ===== exercises (50) =====
UPDATE exercises SET description = 'آماده‌سازی: روی نیمکت صاف دراز بکشید، کتف‌ها را عقب و پایین بدهید و هالتر را کمی بازتر از عرض شانه بگیرید.
اجرا: هالتر را تا میانهٔ سینه پایین بیاورید و با بازدم بالا بفشارید.
نکته: پاها محکم روی زمین و باسن روی نیمکت بماند؛ برای وزنه‌های سنگین از همیار استفاده کنید.
عضلات کمکی: سه‌سر بازو و دلتوئید جلویی.' WHERE name_en = 'Barbell Bench Press' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: روی نیمکت صاف دراز بکشید و دمبل‌ها را کنار سینه نگه دارید.
اجرا: دمبل‌ها را بالا بفشارید تا نزدیک هم شوند و با کنترل پایین بیاورید.
نکته: دامنهٔ حرکت بیشتر از هالتر است؛ آرنج‌ها را زیاد از بدن دور نکنید.
عضلات کمکی: سه‌سر بازو و دلتوئید جلویی.' WHERE name_en = 'Dumbbell Bench Press' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: نیمکت را روی ۳۰ تا ۴۵ درجه تنظیم کنید و هالتر را کمی بازتر از شانه بگیرید.
اجرا: هالتر را تا بالای سینه پایین بیاورید و بالا بفشارید.
نکته: شیب خیلی زیاد فشار را به شانه می‌برد؛ بخش بالای سینه را هدف می‌گیرد.
عضلات کمکی: دلتوئید جلویی و سه‌سر بازو.' WHERE name_en = 'Incline Barbell Bench Press' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: روی نیمکت شیب‌دار بنشینید و دمبل‌ها را کنار بالای سینه نگه دارید.
اجرا: دمبل‌ها را بالا بفشارید و آرام پایین بیاورید.
نکته: مچ‌ها را صاف نگه دارید و دمبل‌ها را بیش از حد به هم نکوبید.
عضلات کمکی: دلتوئید جلویی و سه‌سر بازو.' WHERE name_en = 'Incline Dumbbell Press' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: دست‌ها کمی بازتر از شانه روی زمین و بدن از سر تا پاشنه یک خط صاف.
اجرا: سینه را تا نزدیک زمین پایین ببرید و با فشار دست‌ها بالا بیایید.
نکته: لگن نیفتد؛ برای آسان‌تر شدن زانوها را روی زمین بگذارید.
عضلات کمکی: سه‌سر بازو، دلتوئید جلویی و شکم.' WHERE name_en = 'Push-Up' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: روی نیمکت صاف دراز بکشید و دمبل‌ها را با کف دست رو به هم بالای سینه نگه دارید.
اجرا: با آرنج‌های اندکی خم دست‌ها را قوسی باز کنید تا کشش سینه حس شود و ببندید.
نکته: وزنه سبک‌تر از پرس انتخاب کنید و آرنج را بیش از حد پایین نبرید.
عضلات کمکی: دلتوئید جلویی.' WHERE name_en = 'Dumbbell Fly' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: بین دو قرقرهٔ بالا بایستید، دسته‌ها را بگیرید و کمی به جلو خم شوید.
اجرا: دست‌ها را قوسی جلوی بدن به هم نزدیک کنید و سینه را فشار دهید.
نکته: کشش ثابت کابل برای انقباض و شکل‌دهی سینه عالی است؛ بدن را تکان ندهید.
عضلات کمکی: دلتوئید جلویی.' WHERE name_en = 'Cable Crossover' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: میله را با کف دست رو به جلو و بازتر از شانه بگیرید و آویزان شوید.
اجرا: با کشیدن آرنج‌ها به پایین چانه را بالای میله ببرید و آرام برگردید.
نکته: از تاب‌دادن بدن بپرهیزید؛ در صورت نیاز از دستگاه کمک‌بارفیکس یا کش استفاده کنید.
عضلات کمکی: دوسر بازو و ساعد.' WHERE name_en = 'Pull-Up' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: با میلهٔ بلند بنشینید، ران‌ها را زیر پد قفل کنید و دست‌ها را بازتر از شانه بگیرید.
اجرا: میله را تا بالای سینه بکشید و کتف‌ها را به هم نزدیک کنید، سپس کنترل‌شده رها کنید.
نکته: بدن را زیاد عقب نبرید؛ کشش را با آرنج هدایت کنید.
عضلات کمکی: دوسر بازو و دلتوئید پشتی.' WHERE name_en = 'Wide-Grip Lat Pulldown' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: با زانوی کمی خم کمر را تقریباً موازی زمین کنید و هالتر را با دست‌های صاف بگیرید.
اجرا: هالتر را به سمت پایین سینه بکشید و آرام پایین بیاورید.
نکته: کمر صاف بماند و از کمک‌گرفتن با تکان بدن پرهیز کنید.
عضلات کمکی: دوسر بازو، دلتوئید پشتی و ذوزنقه.' WHERE name_en = 'Barbell Bent-Over Row' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: یک دست و یک زانو را روی نیمکت بگذارید و دمبل را با دست دیگر آویزان کنید.
اجرا: دمبل را به سمت کمر بکشید و آرام پایین ببرید.
نکته: کمر موازی زمین بماند و تنه نچرخد؛ هر طرف را جداگانه کار کنید.
عضلات کمکی: دوسر بازو و دلتوئید پشتی.' WHERE name_en = 'One-Arm Dumbbell Row' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: پاها به‌اندازهٔ عرض لگن، هالتر روی وسط کف پا و دست‌ها بیرون زانو.
اجرا: با فشار پاها و باز کردن لگن بایستید و هالتر را نزدیک بدن نگه دارید.
نکته: کمر کاملاً صاف بماند؛ در شروع با وزنهٔ سبک تکنیک را یاد بگیرید.
عضلات کمکی: باسن، همسترینگ، ذوزنقه و ساعد.' WHERE name_en = 'Deadlift' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: روی دستگاه بنشینید، پاها را روی پدال بگذارید و دسته را بگیرید.
اجرا: دسته را به شکم بکشید و کتف‌ها را به هم برسانید، سپس کنترل‌شده برگردید.
نکته: کمر را صاف نگه دارید و بدن را زیاد جلو و عقب نبرید.
عضلات کمکی: دوسر بازو و دلتوئید پشتی.' WHERE name_en = 'Seated Cable Row' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: هالتر را با دست‌های صاف جلوی ران‌ها بگیرید.
اجرا: شانه‌ها را مستقیم به سمت گوش‌ها بالا بکشید، یک ثانیه نگه دارید و پایین بیاورید.
نکته: شانه‌ها را نچرخانید؛ برای وزنه‌های سنگین از مچ‌بند کمک بگیرید.
عضلات کمکی: ساعد.' WHERE name_en = 'Barbell Shrug' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: هالتر را روی عضلهٔ ذوزنقه بگذارید، پاها کمی بازتر از شانه و پنجه‌ها اندکی به بیرون.
اجرا: تا موازی یا کمی پایین‌تر بنشینید و با فشار پاشنه بایستید.
نکته: کمر صاف و زانوها همراستای پنجه بماند؛ برای وزنه‌های سنگین از رک ایمنی استفاده کنید.
عضلات کمکی: باسن، شکم و کمر.' WHERE name_en = 'Barbell Squat' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: پشت را به تکیه‌گاه بچسبانید و پاها را به‌اندازهٔ شانه روی سکو بگذارید.
اجرا: سکو را تا خم‌شدن ۹۰ درجهٔ زانو پایین بیاورید و با فشار پاها بالا برانید.
نکته: باسن از صندلی بلند نشود و زانوها در بالا قفل نشوند.
عضلات کمکی: باسن و همسترینگ.' WHERE name_en = 'Leg Press' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: ایستاده با دمبل در دو دست.
اجرا: یک قدم به جلو بردارید، زانوی عقب را تا نزدیک زمین پایین ببرید و با پای جلو برگردید.
نکته: تنه صاف بماند و زانوی جلو از پنجه جلوتر نرود.
عضلات کمکی: باسن، همسترینگ و شکم.' WHERE name_en = 'Dumbbell Lunge' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: روی دستگاه بنشینید و پد را روی ساق، نزدیک مچ، تنظیم کنید.
اجرا: پاها را تا صاف‌شدن بالا بیاورید، یک ثانیه منقبض کنید و آرام پایین ببرید.
نکته: با وزنهٔ بیش از حد ضربه نزنید؛ برای مفصل زانو حساس مراقب باشید.
عضلات کمکی: ندارد (ایزوله).' WHERE name_en = 'Leg Extension' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: روی دستگاه دمر یا نشسته قرار بگیرید و پد را پشت ساق، بالای پاشنه، تنظیم کنید.
اجرا: ساق‌ها را به سمت باسن خم کنید و آرام برگردید.
نکته: لگن از پد بلند نشود و حرکت را کنترل‌شده انجام دهید.
عضلات کمکی: ساق پا.' WHERE name_en = 'Leg Curl' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: هالتر را جلوی ران‌ها بگیرید، زانوها کمی خم و کمر صاف.
اجرا: لگن را به عقب ببرید و هالتر را کنار پاها تا زیر زانو پایین بیاورید، سپس با فشار لگن بایستید.
نکته: هالتر نزدیک بدن بماند و کشش همسترینگ حس شود؛ کمر گرد نشود.
عضلات کمکی: باسن و کمر.' WHERE name_en = 'Romanian Deadlift' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: کتف‌ها را روی نیمکت بگذارید و هالتر را روی لگن قرار دهید، پاها روی زمین.
اجرا: لگن را بالا ببرید تا بدن از شانه تا زانو یک خط شود و باسن را فشار دهید.
نکته: چانه را به سینه نزدیک کنید و کمر را بیش از حد قوس ندهید.
عضلات کمکی: همسترینگ و شکم.' WHERE name_en = 'Hip Thrust' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: روی دستگاه یا لبهٔ پله فقط جلوی کف پا را بگذارید.
اجرا: پاشنه‌ها را تا حد ممکن بالا ببرید و تا کشش کامل پایین بیاورید.
نکته: دامنهٔ کامل و مکث کوتاه در بالا مهم‌تر از وزنهٔ سنگین است.
عضلات کمکی: ندارد (ایزوله).' WHERE name_en = 'Standing Calf Raise' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: روی دستگاه بنشینید و پد را روی زانوها تنظیم کنید.
اجرا: پاشنه‌ها را بالا ببرید و آرام پایین بیاورید.
نکته: با زانوی خم عضلهٔ نعلی (سولئوس) بیشتر درگیر می‌شود.
عضلات کمکی: ندارد (ایزوله).' WHERE name_en = 'Seated Calf Raise' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: زیر میلهٔ اسمیت بایستید و جلوی کف پا را روی صفحه یا پله بگذارید.
اجرا: پاشنه‌ها را بالا ببرید و تا کشش کامل پایین بیاورید.
نکته: میله را قفل نگه دارید و دامنهٔ کامل را رعایت کنید.
عضلات کمکی: ندارد (ایزوله).' WHERE name_en = 'Smith Machine Calf Raise' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: ایستاده، هالتر روی دلتوئید جلویی و ترقوه و دست‌ها کمی بازتر از شانه.
اجرا: هالتر را بالای سر بفشارید تا آرنج‌ها صاف شوند و آرام برگردانید.
نکته: شکم و باسن را سفت کنید و کمر را قوس ندهید.
عضلات کمکی: سه‌سر بازو و ذوزنقه.' WHERE name_en = 'Barbell Overhead Press' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: نشسته با پشت صاف، دمبل‌ها را هم‌سطح شانه نگه دارید.
اجرا: دمبل‌ها را بالا بفشارید تا نزدیک هم شوند و با کنترل پایین بیاورید.
نکته: وزنه را بدون تکان بالا ببرید؛ مچ‌ها بالای آرنج باشند.
عضلات کمکی: سه‌سر بازو و ذوزنقه.' WHERE name_en = 'Dumbbell Shoulder Press' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: ایستاده با دمبل‌های سبک کنار بدن.
اجرا: دست‌ها را با آرنج اندکی خم تا هم‌سطح شانه به پهلو بالا ببرید و آرام پایین بیاورید.
نکته: بالاتر از شانه نروید و تاب نخورید؛ وزنه سبک و تکرار بالا مناسب است.
عضلات کمکی: ذوزنقه و دلتوئید جلویی.' WHERE name_en = 'Dumbbell Lateral Raise' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: با زانوی کمی خم، تنه را تقریباً موازی زمین کنید و دمبل‌ها را آویزان بگیرید.
اجرا: دست‌ها را به پهلو بالا ببرید تا هم‌سطح شانه شوند و برگردید.
نکته: وزنه سبک باشد و کمر صاف بماند.
عضلات کمکی: ذوزنقه و رومبوئید.' WHERE name_en = 'Bent-Over Rear Delt Raise' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: طناب را از قرقرهٔ بالای سر بگیرید و چند قدم عقب بروید.
اجرا: طناب را به سمت صورت بکشید و دو سر آن را از هم جدا کنید، آرنج‌ها بالا.
نکته: وزنه سبک و تکرار بالا؛ برای سلامت شانه عالی است.
عضلات کمکی: ذوزنقه و کفچهٔ چرخاننده.' WHERE name_en = 'Face Pull' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: ایستاده با دمبل‌ها جلوی ران‌ها.
اجرا: یک یا دو دست را تا هم‌سطح شانه به جلو بالا ببرید و آرام پایین بیاورید.
نکته: بدن را تاب ندهید؛ در پرس‌ها این ناحیه بسیار درگیر می‌شود، پس حجم را متعادل نگه دارید.
عضلات کمکی: سینه (بالا) و ذوزنقه.' WHERE name_en = 'Dumbbell Front Raise' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: ایستاده، هالتر را با کف دست رو به بالا و به‌اندازهٔ شانه بگیرید.
اجرا: هالتر را تا سطح شانه بالا بیاورید و آرام پایین ببرید.
نکته: آرنج‌ها کنار بدن ثابت بماند و کمر تکان نخورد.
عضلات کمکی: براکیالیس و ساعد.' WHERE name_en = 'Barbell Curl' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: ایستاده یا نشسته با دمبل‌ها کنار بدن.
اجرا: دمبل‌ها را بالا بیاورید و در بالا مچ را کمی بچرخانید، سپس آرام پایین ببرید.
نکته: به‌صورت یک‌درمیان یا هم‌زمان انجام می‌شود؛ تاب‌دادن بدن ممنوع.
عضلات کمکی: براکیالیس و ساعد.' WHERE name_en = 'Dumbbell Curl' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: دمبل‌ها را با کف دست رو به هم (حالت چکشی) بگیرید.
اجرا: دمبل‌ها را بالا بیاورید و آرام پایین ببرید.
نکته: براکیالیس و ساعد را بیشتر درگیر می‌کند؛ آرنج‌ها ثابت بمانند.
عضلات کمکی: دوسر بازو و ساعد.' WHERE name_en = 'Hammer Curl' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: روی نیمکت لاری بنشینید و بازوها را روی پد بگذارید.
اجرا: وزنه را بالا بیاورید و در پایین دست را کاملاً صاف نکنید.
نکته: اجازهٔ تقلب با بدن نمی‌دهد؛ پایین‌آوردن کامل با وزنهٔ سنگین فشار به تاندون می‌آورد.
عضلات کمکی: براکیالیس.' WHERE name_en = 'Preacher Curl' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: روبه‌روی قرقرهٔ پایین بایستید و دستهٔ مستقیم یا EZ را بگیرید.
اجرا: دسته را بالا بیاورید و آرام برگردید.
نکته: کشش ثابت کابل در تمام دامنه؛ آرنج‌ها کنار بدن بماند.
عضلات کمکی: براکیالیس و ساعد.' WHERE name_en = 'Cable Curl' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: روبه‌روی قرقرهٔ بالا بایستید، میلهٔ صاف را بگیرید و آرنج‌ها را به پهلو بچسبانید.
اجرا: میله را پایین فشار دهید تا دست‌ها صاف شوند و آرام برگردید.
نکته: فقط ساعد حرکت کند؛ شانه‌ها بالا نیایند.
عضلات کمکی: ندارد (ایزوله).' WHERE name_en = 'Triceps Pushdown' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: روی نیمکت دراز بکشید و هالتر EZ را با دست‌های صاف بالای سینه نگه دارید.
اجرا: آرنج‌ها را خم کنید و هالتر را به سمت پیشانی پایین ببرید، سپس بالا بفشارید.
نکته: آرنج‌ها به هم نزدیک بماند؛ برای حفظ مفصل آرنج وزنه را متعادل انتخاب کنید.
عضلات کمکی: ندارد (ایزوله).' WHERE name_en = 'Lying Triceps Extension (Skull Crusher)' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: روی میله‌های موازی بالا بروید و بدن را صاف نگه دارید.
اجرا: آرنج‌ها را خم کنید و پایین بروید تا بازو حدود ۹۰ درجه شود و بالا بیایید.
نکته: تنه عمودی بماند تا پشت بازو بیشتر درگیر شود؛ از عمق بیش از حد بپرهیزید.
عضلات کمکی: سینه و دلتوئید جلویی.' WHERE name_en = 'Triceps Dip' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: تنه را خم کنید و آرنج را کنار بدن، هم‌سطح تنه، نگه دارید.
اجرا: ساعد را عقب ببرید تا دست صاف شود و یک ثانیه منقبض کنید.
نکته: وزنه سبک و حرکت دقیق؛ فقط ساعد حرکت کند.
عضلات کمکی: ندارد (ایزوله).' WHERE name_en = 'Dumbbell Kickback' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: نشسته یا ایستاده، یک دمبل را با دو دست بالای سر نگه دارید.
اجرا: آرنج‌ها را خم کنید تا دمبل پشت سر پایین برود و با باز کردن آرنج بالا بیاورید.
نکته: آرنج‌ها به سمت جلو و نزدیک سر بماند.
عضلات کمکی: ندارد (ایزوله).' WHERE name_en = 'Overhead Triceps Extension' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: به پشت بخوابید، زانوها خم و دست‌ها کنار سر.
اجرا: شانه‌ها را کمی از زمین بلند کنید و شکم را منقبض کنید، سپس آرام برگردید.
نکته: گردن را نکشید؛ دامنهٔ حرکت کوتاه است.
عضلات کمکی: ندارد (ایزوله).' WHERE name_en = 'Crunch' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: روی ساعد و پنجهٔ پا تکیه کنید و بدن را صاف نگه دارید.
اجرا: ۳۰ تا ۶۰ ثانیه ثابت بمانید و شکم و باسن را سفت کنید.
نکته: لگن بالا یا پایین نیفتد.
عضلات کمکی: شانه، باسن و کمر.' WHERE name_en = 'Plank' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: از میله آویزان شوید و بدن را ثابت نگه دارید.
اجرا: پاها را تا سطح لگن یا بالاتر بالا بیاورید و آرام پایین ببرید.
نکته: از تاب‌دادن بدن پرهیز کنید؛ برای آسان‌تر شدن زانوها را خم کنید.
عضلات کمکی: فلکسور لگن و ساعد.' WHERE name_en = 'Hanging Leg Raise' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: جلوی قرقرهٔ بالا زانو بزنید و طناب را کنار سر بگیرید.
اجرا: تنه را به سمت پایین خم کنید و شکم را منقبض کنید، سپس برگردید.
نکته: حرکت از ستون فقرات باشد نه لگن؛ بار را تدریجی زیاد کنید.
عضلات کمکی: ندارد (ایزوله).' WHERE name_en = 'Cable Crunch' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: بنشینید، زانوها خم و تنه کمی به عقب مایل.
اجرا: تنه را به راست و چپ بچرخانید و در صورت نیاز وزنه در دست بگیرید.
نکته: کمر صاف بماند و حرکت از تنه باشد نه فقط دست‌ها.
عضلات کمکی: عضلات مایل.' WHERE name_en = 'Russian Twist' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: روی دستگاه بنشینید و دسته‌ها را بگیرید.
اجرا: تنه را به سمت جلو خم کنید و شکم را منقبض کنید، سپس آرام برگردید.
نکته: وزنه را با شکم هدایت کنید نه با بازو.
عضلات کمکی: ندارد (ایزوله).' WHERE name_en = 'Ab Machine Crunch' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: با کفش مناسب و گرم‌کردن کوتاه شروع کنید.
اجرا: با سرعت راحت و قابل صحبت‌کردن شروع کنید و مدت و سرعت را کم‌کم زیاد کنید.
نکته: قامت صاف، فرود نرم روی میانهٔ پا؛ سرعت را بر اساس هدف (استقامت یا سوخت چربی) تنظیم کنید.
عضلات کمکی: چهارسر ران، همسترینگ، ساق و باسن.' WHERE name_en = 'Running' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: طناب هم‌اندازهٔ قد (وسط طناب زیر پا، دسته‌ها تا زیر بغل).
اجرا: با پرش‌های کوتاه از مچ طناب را بچرخانید.
نکته: ارتفاع پرش کم باشد و فرود روی پنجه و نرم؛ برای شروع در دسته‌های ۳۰ ثانیه‌ای انجام دهید.
عضلات کمکی: ساق، شانه و ساعد.' WHERE name_en = 'Jump Rope' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: زین را هم‌ارتفاع لگن تنظیم کنید و دست‌ها را روی فرمان بگذارید.
اجرا: با مقاومت دلخواه رکاب بزنید و ضرباهنگ را ثابت نگه دارید.
نکته: کم‌فشار برای مفاصل است؛ زانوها همراستای پنجه باشند.
عضلات کمکی: چهارسر ران، همسترینگ و ساق.' WHERE name_en = 'Stationary Bike' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE exercises SET description = 'آماده‌سازی: روی پدال‌ها بایستید و دسته‌ها را بگیرید.
اجرا: با حرکت روان پاها و دست‌ها پیش بروید و مقاومت را تنظیم کنید.
نکته: قامت صاف و بدون تکیه بر دسته‌ها؛ تمرین کم‌فشار برای مفاصل است.
عضلات کمکی: چهارسر ران، باسن، همسترینگ و بازوها.' WHERE name_en = 'Elliptical Trainer' AND created_by IS NULL AND (description IS NULL OR description = '');
-- ===== foods (72) =====
UPDATE foods SET description = 'منبع پروتئین بسیار بالا و چربی کم؛ پایهٔ بسیاری از رژیم‌های ورزشی. مقادیر برای گوشت پخته است.' WHERE name_en = 'Chicken Breast' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'آبدارتر و کمی پرچرب‌تر از سینه مرغ؛ پروتئین خوب با طعم بهتر.' WHERE name_en = 'Skinless Chicken Thigh' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'پروتئین، آهن و زینک بالا؛ بخش‌های کم‌چرب را انتخاب کنید.' WHERE name_en = 'Lean Beef' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'منبع پروتئین و آهن؛ چربی دم و پیه را جدا کنید.' WHERE name_en = 'Lean Lamb' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'پروتئین بالا و چربی‌های مفید امگا ۳؛ گزینهٔ در دسترس و مقرون‌به‌صرفه.' WHERE name_en = 'Trout' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'غنی از امگا ۳ و ویتامین D؛ پرکالری‌تر از ماهی‌های سفید.' WHERE name_en = 'Salmon' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'پروتئین بالا و بسیار کم‌چرب؛ آماده مصرف. به نمک آن دقت کنید.' WHERE name_en = 'Canned Tuna in Water' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'پروتئین بالا و کالری بسیار کم؛ مناسب دوره کات.' WHERE name_en = 'Shrimp' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'پروتئین کامل با ویتامین B12 و کولین؛ زرده منبع ریزمغذی‌هاست. هر عدد متوسط حدود ۵۰ گرم فرض شده است.' WHERE name_en = 'Whole Egg' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'پروتئین خالص با چربی تقریباً صفر؛ برای کاهش کالری مناسب است.' WHERE name_en = 'Egg White' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'پروتئین بالا و چربی بسیار کم؛ جایگزین خوب سینه مرغ.' WHERE name_en = 'Turkey Breast' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'کربوهیدرات سریع‌هضم و پرمصرف؛ مقادیر برای برنج پخته است.' WHERE name_en = 'Cooked White Rice' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'فیبر و منیزیم بیشتر از برنج سفید و جذب کندتر؛ مقادیر برای برنج پخته است.' WHERE name_en = 'Cooked Brown Rice' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'کربوهیدرات کندجذب با فیبر محلول؛ مناسب صبحانه و قبل از تمرین. مقادیر برای جو دوسر خشک است.' WHERE name_en = 'Rolled Oats' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'نان سنتی کامل‌تر با فیبر بیشتر از نان سفید؛ مقدار هر واحد (برش) تقریبی است.' WHERE name_en = 'Sangak Bread' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'نان پرمصرف با کربوهیدرات بالا؛ مقدار هر واحد (برش) تقریبی است.' WHERE name_en = 'Barbari Bread' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'نان با فیبر بیشتر و شاخص گلیسمی کمتر؛ مقدار هر واحد (برش) تقریبی است.' WHERE name_en = 'Barley Bread' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'کربوهیدرات پرانرژی؛ مقادیر برای ماکارونی پخته است.' WHERE name_en = 'Cooked Pasta' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'کربوهیدرات سیرکننده و کم‌چرب با پتاسیم بالا؛ به‌صورت آب‌پز مصرف شود.' WHERE name_en = 'Boiled Potato' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'کربوهیدرات کندجذب با ویتامین A؛ گزینه‌ای عالی قبل از تمرین.' WHERE name_en = 'Sweet Potato' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'غلات بدون گلوتن با پروتئین کامل نسبت به سایر غلات؛ مقادیر برای کینوای پخته است.' WHERE name_en = 'Cooked Quinoa' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'کربوهیدرات و فیبر؛ مقادیر برای ذرت پخته است.' WHERE name_en = 'Cooked Corn' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'پروتئین گیاهی، فیبر و آهن بالا؛ مقادیر برای عدس پخته است.' WHERE name_en = 'Cooked Lentils' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'حبوبات پرفیبر و پروتئین گیاهی؛ مقادیر برای لپهٔ پخته است.' WHERE name_en = 'Cooked Split Peas' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'پروتئین گیاهی، فیبر و کربوهیدرات کندجذب؛ مقادیر برای نخود پخته است.' WHERE name_en = 'Cooked Chickpeas' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'پروتئین گیاهی و فیبر بالا؛ مقادیر برای لوبیای پخته است.' WHERE name_en = 'Cooked Red Beans' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'پروتئین گیاهی و فیبر؛ مقادیر برای لوبیا چیتی پخته است.' WHERE name_en = 'Cooked Pinto Beans' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'پروتئین گیاهی بسیار بالا؛ مقادیر برای سویای خشک است و قبل مصرف خیس می‌شود.' WHERE name_en = 'Soy Chunks' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'پروتئین و کلسیم با چربی کمتر؛ هر لیوان حدود ۲۴۰ تا ۲۴۴ گرم فرض شده است.' WHERE name_en = 'Low-Fat Milk' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'پروتئین، کلسیم و پروبیوتیک؛ گزینهٔ خوب برای میان‌وعده.' WHERE name_en = 'Low-Fat Yogurt' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'پروتئین بسیار بالاتر از ماست معمولی و قند کم؛ برای سیری و ریکاوری عالی است.' WHERE name_en = 'Greek Yogurt' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'پروتئین و کلسیم با چربی کم؛ به نمک آن توجه کنید.' WHERE name_en = 'Low-Fat Cheese' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'غذای لبنی سنتی با پروتئین و طعم قوی؛ سدیم بالایی دارد. هر قاشق حدود ۱۵ گرم فرض شده است.' WHERE name_en = 'Kashk' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'نوشیدنی لبنی کم‌کالری با کمی پروتئین؛ نوع بدون گاز و کم‌نمک بهتر است.' WHERE name_en = 'Doogh' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'جایگزین گیاهی شیر با پروتئین قابل قبول؛ نوع بدون شکر را انتخاب کنید.' WHERE name_en = 'Soy Milk' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'کم‌کالری و پرحجم؛ پایهٔ سالاد برای افزایش سیری در رژیم کات.' WHERE name_en = 'Lettuce' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'ویتامین C و لیکوپن با کالری کم. هر عدد متوسط حدود ۱۲۰ گرم فرض شده است.' WHERE name_en = 'Tomato' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'آبدار و بسیار کم‌کالری. هر عدد متوسط حدود ۱۰۰ گرم فرض شده است.' WHERE name_en = 'Cucumber' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'فیبر، ویتامین C و K با کالری کم؛ از بهترین سبزی‌ها برای ورزشکاران.' WHERE name_en = 'Broccoli' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'آهن، منیزیم و ویتامین K؛ بسیار کم‌کالری.' WHERE name_en = 'Spinach' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'بتاکاروتن (ویتامین A) و فیبر. هر عدد متوسط حدود ۶۰ گرم فرض شده است.' WHERE name_en = 'Carrot' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'کم‌کالری و آبدار؛ جایگزین خوب برای افزودن حجم به غذا.' WHERE name_en = 'Zucchini' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'ویتامین C بالا و کالری کم. هر عدد متوسط حدود ۱۲۰ گرم فرض شده است.' WHERE name_en = 'Bell Pepper' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'طعم‌دهنده با کالری کم و ترکیبات آنتی‌اکسیدان. هر عدد متوسط حدود ۱۱۰ گرم فرض شده است.' WHERE name_en = 'Onion' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'ویتامین و آنتی‌اکسیدان با کالری ناچیز. هر مشت حدود ۳۰ گرم فرض شده است.' WHERE name_en = 'Fresh Herbs' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'کربوهیدرات سریع و پتاسیم؛ گزینهٔ عالی قبل یا بعد از تمرین. هر عدد حدود ۱۱۸ گرم فرض شده است.' WHERE name_en = 'Banana' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'فیبر و آنتی‌اکسیدان؛ سیرکننده. هر عدد حدود ۱۸۰ گرم فرض شده است.' WHERE name_en = 'Apple' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'ویتامین C بالا و آب. هر عدد حدود ۱۳۰ گرم فرض شده است.' WHERE name_en = 'Orange' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'کربوهیدرات سریع و پرانرژی؛ مناسب قبل از تمرین. هر عدد حدود ۱۰ گرم فرض شده است.' WHERE name_en = 'Date' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'کربوهیدرات سریع‌جذب و آنتی‌اکسیدان؛ قند نسبتاً بالاست.' WHERE name_en = 'Grapes' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'کم‌کالری با ویتامین C و آنتی‌اکسیدان بالا.' WHERE name_en = 'Strawberry' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'ویتامین C و فیبر بالا. هر عدد حدود ۷۵ گرم فرض شده است.' WHERE name_en = 'Kiwi' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'بسیار آبدار و کم‌کالری؛ کمک به آبرسانی.' WHERE name_en = 'Watermelon' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'ویتامین C و آنزیم برومِلین؛ کربوهیدرات سریع.' WHERE name_en = 'Pineapple' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'چربی سالم، ویتامین E و پروتئین؛ پرکالری است و باید وزن شود.' WHERE name_en = 'Almonds' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'منبع امگا ۳ گیاهی و چربی سالم؛ کالری بسیار بالا.' WHERE name_en = 'Walnuts' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'چربی سالم و پروتئین؛ نوع بدون نمک بهتر است و کالری بالایی دارد.' WHERE name_en = 'Pistachios' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'پروتئین و چربی سالم ارزان؛ کالری بالا.' WHERE name_en = 'Peanuts' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'چربی و پروتئین پرکالری؛ نوع بدون شکر و بدون روغن اضافه را انتخاب کنید. هر قاشق حدود ۱۶ گرم فرض شده است.' WHERE name_en = 'Peanut Butter' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'چربی تک‌غیراشباع و سالم؛ کالری بسیار بالا و باید با قاشق اندازه‌گیری شود. هر قاشق حدود ۱۴ گرم فرض شده است.' WHERE name_en = 'Olive Oil' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'چربی سالم، فیبر و پتاسیم؛ کالری بالا. هر عدد حدود ۱۵۰ گرم فرض شده است.' WHERE name_en = 'Avocado' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'فیبر بالا و امگا ۳ گیاهی؛ در آب یا ماست خیس شود. هر قاشق حدود ۱۲ گرم فرض شده است.' WHERE name_en = 'Chia Seeds' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'منیزیم و زینک و پروتئین؛ کالری بالا.' WHERE name_en = 'Pumpkin Seeds' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'پروتئین سریع‌جذب برای رسیدن به هدف پروتئین روزانه؛ مقدار هر اسکوپ بسته به برند متفاوت است.' WHERE name_en = 'Whey Protein Powder' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'پرمصرف‌ترین مکمل قدرتی؛ معمولاً ۳ تا ۵ گرم در روز، بدون کالری.' WHERE name_en = 'Creatine Monohydrate' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'مکمل پرکالری برای افزایش وزن؛ ارزش غذایی برندها بسیار متفاوت است، پس مقدار را از روی برچسب محصول وارد کنید.' WHERE name_en = 'Mass Gainer' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'مجموعهٔ ویتامین و مواد معدنی؛ کالری ناچیز.' WHERE name_en = 'Multivitamin' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'چربی‌های ضروری امگا ۳؛ کالری بسیار کم.' WHERE name_en = 'Omega-3' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'آبرسانی؛ بدون کالری.' WHERE name_en = 'Water' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'بدون کالری، حاوی کمی کافئین و آنتی‌اکسیدان.' WHERE name_en = 'Green Tea' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'کافئین برای افزایش تمرکز و انرژی؛ بدون شکر و شیر کالری ناچیز دارد.' WHERE name_en = 'Black Coffee' AND created_by IS NULL AND (description IS NULL OR description = '');
UPDATE foods SET description = 'کربوهیدرات سریع‌جذب و ویتامین؛ فیبر کمتر از میوه کامل دارد و کالری آن زیاد است.' WHERE name_en = 'Fresh Fruit Juice' AND created_by IS NULL AND (description IS NULL OR description = '');
