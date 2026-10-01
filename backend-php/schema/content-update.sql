-- Phase 8: ready-made content for trainers. Public workout / nutrition
-- templates, techniques and questionnaires (is_public = 1, owned by an admin)
-- that every trainer can copy into their own; and an image / video for each
-- exercise in the library.
-- Run it from the admin panel (Database updates), or in phpMyAdmin -> SQL
-- after taking a backup. Do NOT re-import schema.sql.

ALTER TABLE workout_assignments
  ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 0 AFTER is_template;

ALTER TABLE nutrition_assignments
  ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 0 AFTER is_template;

ALTER TABLE techniques
  ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 0 AFTER description;

ALTER TABLE questionnaires
  ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active;

ALTER TABLE exercises
  ADD COLUMN image_url VARCHAR(1024) NULL AFTER description,
  ADD COLUMN video_url VARCHAR(1024) NULL AFTER image_url;

-- Starter content, owned by the first platform admin (nothing is added if
-- there is none yet). The admin can edit or remove any of it from the panel.

INSERT INTO techniques (id, coach_id, name, description, is_public)
  SELECT '7e000000-0000-4000-8000-000000000001', p.id, 'سوپرست', 'دو حرکت پشت سر هم و بدون استراحت بین آن‌ها. معمولاً برای دو عضلهٔ مخالف (مثل جلو بازو و پشت بازو) یا برای افزایش فشار روی یک عضله.', 1 FROM profiles p WHERE p.is_platform_admin = 1 ORDER BY p.created_at LIMIT 1;

INSERT INTO techniques (id, coach_id, name, description, is_public)
  SELECT '7e000000-0000-4000-8000-000000000002', p.id, 'تری‌ست', 'سه حرکت پشت سر هم و بدون استراحت. استراحت فقط بعد از حرکت سوم.', 1 FROM profiles p WHERE p.is_platform_admin = 1 ORDER BY p.created_at LIMIT 1;

INSERT INTO techniques (id, coach_id, name, description, is_public)
  SELECT '7e000000-0000-4000-8000-000000000003', p.id, 'جاینت‌ست', 'چهار حرکت یا بیشتر برای یک گروه عضلانی، پشت سر هم و بدون استراحت.', 1 FROM profiles p WHERE p.is_platform_admin = 1 ORDER BY p.created_at LIMIT 1;

INSERT INTO techniques (id, coach_id, name, description, is_public)
  SELECT '7e000000-0000-4000-8000-000000000004', p.id, 'دراپ‌ست', 'بعد از رسیدن به ناتوانی، وزنه حدود ۲۰ تا ۳۰ درصد کم می‌شود و بدون استراحت تکرارها ادامه پیدا می‌کند. معمولاً ۲ تا ۳ بار کم‌کردن وزنه.', 1 FROM profiles p WHERE p.is_platform_admin = 1 ORDER BY p.created_at LIMIT 1;

INSERT INTO techniques (id, coach_id, name, description, is_public)
  SELECT '7e000000-0000-4000-8000-000000000005', p.id, 'رست‌پاز', 'بعد از ناتوانی، ۱۰ تا ۲۰ ثانیه استراحت و دوباره چند تکرار با همان وزنه. معمولاً ۲ تا ۳ بار تکرار می‌شود.', 1 FROM profiles p WHERE p.is_platform_admin = 1 ORDER BY p.created_at LIMIT 1;

INSERT INTO techniques (id, coach_id, name, description, is_public)
  SELECT '7e000000-0000-4000-8000-000000000006', p.id, 'هرمی', 'وزنه در هر ست بیشتر و تعداد تکرار کمتر می‌شود (یا برعکس در هرمی معکوس).', 1 FROM profiles p WHERE p.is_platform_admin = 1 ORDER BY p.created_at LIMIT 1;

INSERT INTO techniques (id, coach_id, name, description, is_public)
  SELECT '7e000000-0000-4000-8000-000000000007', p.id, 'نگاتیو (منفی)', 'تمرکز روی فاز برگشت حرکت: پایین آوردن وزنه آهسته و کنترل‌شده، حدود ۳ تا ۵ ثانیه.', 1 FROM profiles p WHERE p.is_platform_admin = 1 ORDER BY p.created_at LIMIT 1;

INSERT INTO techniques (id, coach_id, name, description, is_public)
  SELECT '7e000000-0000-4000-8000-000000000008', p.id, 'ایزومتریک', 'نگه‌داشتن وزنه در یک نقطه از دامنهٔ حرکت برای چند ثانیه بدون حرکت.', 1 FROM profiles p WHERE p.is_platform_admin = 1 ORDER BY p.created_at LIMIT 1;

INSERT INTO questionnaires (id, coach_id, title, description, price_toman, is_active, is_public)
  SELECT '7e000000-0000-4000-8000-000000000101', p.id, 'فرم آمادگی سلامت پیش از تمرین (PAR-Q)', 'هفت سؤال استاندارد پیش از شروع برنامهٔ تمرینی. اگر پاسخ ورزشکار به هر سؤال «بله» باشد، پیش از شروع یا افزایش شدت تمرین با پزشک مشورت کند.', NULL, 1, 1 FROM profiles p WHERE p.is_platform_admin = 1 ORDER BY p.created_at LIMIT 1;

INSERT INTO questionnaire_questions (id, questionnaire_id, type, label, options, is_required, sort_order)
  SELECT '7e000000-0000-4000-8000-000000000200', q.id, 'multiple_choice', 'آیا پزشک تا به حال گفته است که مشکل قلبی دارید و فقط باید فعالیت بدنیِ تأییدشده توسط پزشک انجام دهید؟', '["بله","خیر"]', 1, 0 FROM questionnaires q WHERE q.id = '7e000000-0000-4000-8000-000000000101';

INSERT INTO questionnaire_questions (id, questionnaire_id, type, label, options, is_required, sort_order)
  SELECT '7e000000-0000-4000-8000-000000000201', q.id, 'multiple_choice', 'آیا هنگام فعالیت بدنی درد قفسهٔ سینه دارید؟', '["بله","خیر"]', 1, 1 FROM questionnaires q WHERE q.id = '7e000000-0000-4000-8000-000000000101';

INSERT INTO questionnaire_questions (id, questionnaire_id, type, label, options, is_required, sort_order)
  SELECT '7e000000-0000-4000-8000-000000000202', q.id, 'multiple_choice', 'آیا در یک ماه گذشته، در زمان استراحت درد قفسهٔ سینه داشته‌اید؟', '["بله","خیر"]', 1, 2 FROM questionnaires q WHERE q.id = '7e000000-0000-4000-8000-000000000101';

INSERT INTO questionnaire_questions (id, questionnaire_id, type, label, options, is_required, sort_order)
  SELECT '7e000000-0000-4000-8000-000000000203', q.id, 'multiple_choice', 'آیا به‌خاطر سرگیجه تعادلتان را از دست می‌دهید یا تا به حال از هوش رفته‌اید؟', '["بله","خیر"]', 1, 3 FROM questionnaires q WHERE q.id = '7e000000-0000-4000-8000-000000000101';

INSERT INTO questionnaire_questions (id, questionnaire_id, type, label, options, is_required, sort_order)
  SELECT '7e000000-0000-4000-8000-000000000204', q.id, 'multiple_choice', 'آیا مشکل استخوانی یا مفصلی (مثلاً کمر، زانو یا لگن) دارید که با تغییر فعالیت بدنی بدتر شود؟', '["بله","خیر"]', 1, 4 FROM questionnaires q WHERE q.id = '7e000000-0000-4000-8000-000000000101';

INSERT INTO questionnaire_questions (id, questionnaire_id, type, label, options, is_required, sort_order)
  SELECT '7e000000-0000-4000-8000-000000000205', q.id, 'multiple_choice', 'آیا پزشک برای فشار خون یا بیماری قلبی برایتان دارو تجویز کرده است؟', '["بله","خیر"]', 1, 5 FROM questionnaires q WHERE q.id = '7e000000-0000-4000-8000-000000000101';

INSERT INTO questionnaire_questions (id, questionnaire_id, type, label, options, is_required, sort_order)
  SELECT '7e000000-0000-4000-8000-000000000206', q.id, 'multiple_choice', 'آیا دلیل دیگری می‌دانید که نباید فعالیت بدنی انجام دهید؟', '["بله","خیر"]', 1, 6 FROM questionnaires q WHERE q.id = '7e000000-0000-4000-8000-000000000101';

INSERT INTO questionnaires (id, coach_id, title, description, price_toman, is_active, is_public)
  SELECT '7e000000-0000-4000-8000-000000000102', p.id, 'فرم اطلاعات اولیهٔ ورزشکار', 'هدف، سابقهٔ تمرین، آسیب‌ها و زمانی که ورزشکار برای تمرین دارد؛ برای نوشتن اولین برنامه.', NULL, 1, 1 FROM profiles p WHERE p.is_platform_admin = 1 ORDER BY p.created_at LIMIT 1;

INSERT INTO questionnaire_questions (id, questionnaire_id, type, label, options, is_required, sort_order)
  SELECT '7e000000-0000-4000-8000-000000000300', q.id, 'multiple_choice', 'هدف اصلی شما از تمرین چیست؟', '["کاهش وزن","افزایش حجم عضلانی","تناسب اندام و سلامتی","افزایش قدرت","آمادگی برای مسابقه"]', 1, 0 FROM questionnaires q WHERE q.id = '7e000000-0000-4000-8000-000000000102';

INSERT INTO questionnaire_questions (id, questionnaire_id, type, label, options, is_required, sort_order)
  SELECT '7e000000-0000-4000-8000-000000000301', q.id, 'multiple_choice', 'چه مدت است به‌طور منظم تمرین می‌کنید؟', '["تازه شروع می‌کنم","کمتر از ۶ ماه","۶ ماه تا ۲ سال","بیش از ۲ سال"]', 1, 1 FROM questionnaires q WHERE q.id = '7e000000-0000-4000-8000-000000000102';

INSERT INTO questionnaire_questions (id, questionnaire_id, type, label, options, is_required, sort_order)
  SELECT '7e000000-0000-4000-8000-000000000302', q.id, 'number', 'هفته‌ای چند روز می‌توانید تمرین کنید؟', NULL, 1, 2 FROM questionnaires q WHERE q.id = '7e000000-0000-4000-8000-000000000102';

INSERT INTO questionnaire_questions (id, questionnaire_id, type, label, options, is_required, sort_order)
  SELECT '7e000000-0000-4000-8000-000000000303', q.id, 'number', 'هر جلسه حدوداً چند دقیقه وقت دارید؟', NULL, 1, 3 FROM questionnaires q WHERE q.id = '7e000000-0000-4000-8000-000000000102';

INSERT INTO questionnaire_questions (id, questionnaire_id, type, label, options, is_required, sort_order)
  SELECT '7e000000-0000-4000-8000-000000000304', q.id, 'text', 'آسیب‌دیدگی، جراحی یا دردی دارید که مربی باید بداند؟', NULL, 1, 4 FROM questionnaires q WHERE q.id = '7e000000-0000-4000-8000-000000000102';

INSERT INTO questionnaire_questions (id, questionnaire_id, type, label, options, is_required, sort_order)
  SELECT '7e000000-0000-4000-8000-000000000305', q.id, 'text', 'بیماری خاص یا دارویی که مصرف می‌کنید؟', NULL, 1, 5 FROM questionnaires q WHERE q.id = '7e000000-0000-4000-8000-000000000102';

INSERT INTO questionnaire_questions (id, questionnaire_id, type, label, options, is_required, sort_order)
  SELECT '7e000000-0000-4000-8000-000000000306', q.id, 'multiple_choice', 'کجا تمرین می‌کنید؟', '["باشگاه","خانه با وسایل","خانه بدون وسیله"]', 1, 6 FROM questionnaires q WHERE q.id = '7e000000-0000-4000-8000-000000000102';

INSERT INTO questionnaire_questions (id, questionnaire_id, type, label, options, is_required, sort_order)
  SELECT '7e000000-0000-4000-8000-000000000307', q.id, 'text', 'توضیح دیگری برای مربی دارید؟', NULL, 0, 7 FROM questionnaires q WHERE q.id = '7e000000-0000-4000-8000-000000000102';
