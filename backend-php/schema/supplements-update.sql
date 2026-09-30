-- Supplement library + supplement plans (reminders ride the notifications table).
-- Run in phpMyAdmin -> SQL, after taking a backup. The first four statements
-- create tables: running them twice errors on "table already exists" and
-- changes nothing. The INSERT statements at the end are safe to repeat: each only adds a preset
-- supplements whose English name is not in the shared library yet.
-- Do NOT re-import schema.sql.

CREATE TABLE supplements (
  id          CHAR(36) NOT NULL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  name_en     VARCHAR(255) NULL,
  description TEXT NULL,
  image_url   VARCHAR(1024) NULL,
  created_by  CHAR(36) NULL,   -- NULL = بانک عمومی، پر = اختصاصی همان مربی (دقیقاً مثل exercises/foods)
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_supplements_creator (created_by),
  CONSTRAINT fk_supplements_creator FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE supplement_usage (
  id            CHAR(36) NOT NULL PRIMARY KEY,
  trainer_id    CHAR(36) NOT NULL,
  supplement_id CHAR(36) NOT NULL,
  use_count     INT NOT NULL DEFAULT 0,
  last_used_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_supplement_usage (trainer_id, supplement_id),
  CONSTRAINT fk_supplement_usage_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_supplement_usage_supplement FOREIGN KEY (supplement_id) REFERENCES supplements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE supplement_assignments (
  id          CHAR(36) NOT NULL PRIMARY KEY,
  trainer_id  CHAR(36) NOT NULL,
  athlete_id  CHAR(36) NOT NULL,
  title       VARCHAR(255) NOT NULL,
  status      ENUM('active','completed','cancelled') NOT NULL DEFAULT 'active',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_sa_trainer (trainer_id),
  KEY idx_sa_athlete (athlete_id, status),
  CONSTRAINT fk_sa_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_sa_athlete FOREIGN KEY (athlete_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE supplement_plan_items (
  id               CHAR(36) NOT NULL PRIMARY KEY,
  assignment_id    CHAR(36) NOT NULL,
  supplement_id    CHAR(36) NOT NULL,
  dose             VARCHAR(100) NOT NULL,     -- متن آزاد، مثل "۵ گرم" یا "۲ کپسول"
  timing           ENUM('before_workout','after_workout','breakfast','lunch','dinner','before_sleep','custom') NOT NULL,
  custom_time      TIME NULL,   -- ساعت یادآوری: اجباری برای custom، اختیاری برای before/after_workout
  note             VARCHAR(255) NULL,
  sort_order       INT NOT NULL DEFAULT 0,
  last_reminded_on DATE NULL,   -- برای این‌که کرون همان روز دوباره یادآوری تکراری نسازد
  KEY idx_spi_assignment (assignment_id, sort_order),
  KEY idx_spi_supplement (supplement_id),
  CONSTRAINT fk_spi_assignment FOREIGN KEY (assignment_id) REFERENCES supplement_assignments(id) ON DELETE CASCADE,
  CONSTRAINT fk_spi_supplement FOREIGN KEY (supplement_id) REFERENCES supplements(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Preset supplements (shared library, created_by IS NULL).
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
