-- Questionnaire builder. Run by hand in phpMyAdmin, top to bottom, AFTER the
-- invoices table (and its session_package enum value) exists and BEFORE the
-- backend deploy. Do not re-import schema.sql.

CREATE TABLE questionnaires (
  id           CHAR(36) NOT NULL PRIMARY KEY,
  coach_id     CHAR(36) NOT NULL,
  title        VARCHAR(255) NOT NULL,
  description  TEXT NULL,
  price_toman  BIGINT NULL,     -- NULL = رایگان
  is_active    TINYINT(1) NOT NULL DEFAULT 1,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_q_coach (coach_id, created_at DESC),
  CONSTRAINT fk_q_coach FOREIGN KEY (coach_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE questionnaire_questions (
  id               CHAR(36) NOT NULL PRIMARY KEY,
  questionnaire_id CHAR(36) NOT NULL,
  type             ENUM('text','multiple_choice','number') NOT NULL,
  label            VARCHAR(500) NOT NULL,
  options          JSON NULL,     -- فقط برای multiple_choice: آرایهٔ رشته‌ها
  is_required      TINYINT(1) NOT NULL DEFAULT 1,
  sort_order       INT NOT NULL DEFAULT 0,
  KEY idx_qq_questionnaire (questionnaire_id, sort_order),
  CONSTRAINT fk_qq_questionnaire FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE questionnaire_responses (
  id               CHAR(36) NOT NULL PRIMARY KEY,
  questionnaire_id CHAR(36) NOT NULL,
  athlete_id       CHAR(36) NOT NULL,
  status           ENUM('assigned','submitted') NOT NULL DEFAULT 'assigned',
  submitted_at     DATETIME NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_qr_questionnaire_athlete (questionnaire_id, athlete_id),
  KEY idx_qr_athlete (athlete_id, status),
  CONSTRAINT fk_qr_questionnaire FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE,
  CONSTRAINT fk_qr_athlete FOREIGN KEY (athlete_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE questionnaire_answers (
  id          CHAR(36) NOT NULL PRIMARY KEY,
  response_id CHAR(36) NOT NULL,
  question_id CHAR(36) NOT NULL,
  value       TEXT NULL,   -- متن/عدد به‌صورت رشته، یا برای multiple_choice همان گزینهٔ انتخابی
  UNIQUE KEY uq_qa_response_question (response_id, question_id),
  CONSTRAINT fk_qa_response FOREIGN KEY (response_id) REFERENCES questionnaire_responses(id) ON DELETE CASCADE,
  CONSTRAINT fk_qa_question FOREIGN KEY (question_id) REFERENCES questionnaire_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Run this LAST, after the invoices SQL of the invoice task (and the
-- session_package ALTER of the private-sessions task, if it is deployed).
ALTER TABLE invoices
  MODIFY COLUMN item_type ENUM('workout_plan','nutrition_plan','session_package','questionnaire') NOT NULL;
