-- ============================================================================
-- Gymlic — Exercise Library: optional description field
--
-- Lets a trainer note execution cues/tips when adding their own custom
-- exercise. Optional, like the English name — only the Persian name and
-- muscle group stay required.
-- ============================================================================

alter table exercises add column description text;
