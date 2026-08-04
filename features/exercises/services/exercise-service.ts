import { createClient } from "@/lib/supabase/client";
import type { ExerciseSummary } from "../types/exercise-types";

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
    .select("id, name, muscle_group, created_by, created_at")
    .order("name", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    muscleGroup: row.muscle_group,
    isCustom: row.created_by !== null,
    createdAt: row.created_at,
  }));
}

export async function createExercise(input: {
  name: string;
  muscleGroup: string;
}): Promise<{ id: string }> {
  const supabase = createClient();
  const trainerId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("exercises")
    .insert({
      name: input.name,
      muscle_group: input.muscleGroup,
      created_by: trainerId,
    })
    .select("id")
    .single();
  if (error) throw error;

  return { id: data.id };
}
