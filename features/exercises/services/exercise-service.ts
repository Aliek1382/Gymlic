import { createClient } from "@/lib/supabase/client";
import type { ExercisePickerItem, ExerciseSummary } from "../types/exercise-types";

async function getCurrentUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("نشست کاربر معتبر نیست.");
  return user.id;
}

export async function listExercises(): Promise<ExerciseSummary[]> {
  const supabase = createClient();
  await getCurrentUserId();

  const { data, error } = await supabase
    .from("exercises")
    .select("id, name, name_en, description, muscle_group, created_by, created_at")
    .order("name", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    nameEn: row.name_en,
    description: row.description,
    muscleGroup: row.muscle_group,
    isCustom: row.created_by !== null,
    createdAt: row.created_at,
  }));
}

export async function listExercisesForPicker(): Promise<ExercisePickerItem[]> {
  const supabase = createClient();
  const trainerId = await getCurrentUserId();

  const [exercisesResult, usageResult] = await Promise.all([
    supabase.from("exercises").select("id, name, name_en, muscle_group, created_by"),
    supabase
      .from("exercise_usage")
      .select("exercise_id, use_count")
      .eq("trainer_id", trainerId),
  ]);
  if (exercisesResult.error) throw exercisesResult.error;
  if (usageResult.error) throw usageResult.error;

  const usageByExercise = new Map(
    (usageResult.data ?? []).map((row) => [row.exercise_id, row.use_count])
  );

  return (exercisesResult.data ?? [])
    .map((row) => ({
      id: row.id,
      name: row.name,
      nameEn: row.name_en,
      muscleGroup: row.muscle_group,
      isCustom: row.created_by !== null,
      usageCount: usageByExercise.get(row.id) ?? 0,
    }))
    .sort(
      (a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name, "fa")
    );
}

export async function recordExerciseUsage(exerciseId: string): Promise<void> {
  const supabase = createClient();
  const trainerId = await getCurrentUserId();

  const { data: existing, error: selectError } = await supabase
    .from("exercise_usage")
    .select("id, use_count")
    .eq("trainer_id", trainerId)
    .eq("exercise_id", exerciseId)
    .maybeSingle();
  if (selectError) throw selectError;

  if (existing) {
    const { error } = await supabase
      .from("exercise_usage")
      .update({
        use_count: existing.use_count + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("exercise_usage").insert({
    trainer_id: trainerId,
    exercise_id: exerciseId,
    use_count: 1,
  });
  if (error) throw error;
}

export async function createExercise(input: {
  name: string;
  nameEn: string | null;
  description: string | null;
  muscleGroup: string;
}): Promise<{ id: string }> {
  const supabase = createClient();
  const trainerId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("exercises")
    .insert({
      name: input.name,
      name_en: input.nameEn,
      description: input.description,
      muscle_group: input.muscleGroup,
      created_by: trainerId,
    })
    .select("id")
    .single();
  if (error) throw error;

  return { id: data.id };
}
