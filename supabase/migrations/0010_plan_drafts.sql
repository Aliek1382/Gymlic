-- ============================================================================
-- Gymlic — Draft status for workout/nutrition plans
--
-- Lets a trainer save an in-progress plan ("بعداً بقیه‌اش را می‌نویسم")
-- instead of only ever submitting a finished one, and resume it later.
-- ============================================================================

alter type workout_status add value if not exists 'draft';
