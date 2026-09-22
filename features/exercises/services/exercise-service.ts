import { api, type ListResponse } from "@/lib/api/client";
import type { ExercisePickerItem, ExerciseSummary } from "../types/exercise-types";

interface ExerciseRow {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  muscle_group: string;
  created_by: string | null;
  created_at: string;
}

export async function listExercises(): Promise<ExerciseSummary[]> {
  const data = await api.get<ListResponse<ExerciseRow>>("/library/exercises");

  return data.items.map((row) => ({
    id: row.id,
    name: row.name,
    nameEn: row.name_en,
    description: row.description,
    muscleGroup: row.muscle_group,
    isCustom: row.created_by !== null,
    createdAt: row.created_at,
  }));
}

/** Already ordered most-used-first by the API, per trainer. */
export async function listExercisesForPicker(): Promise<ExercisePickerItem[]> {
  const data = await api.get<
    ListResponse<Omit<ExerciseRow, "description" | "created_at"> & { usage_count: number }>
  >("/library/exercises/picker");

  return data.items.map((row) => ({
    id: row.id,
    name: row.name,
    nameEn: row.name_en,
    muscleGroup: row.muscle_group,
    isCustom: row.created_by !== null,
    usageCount: row.usage_count,
  }));
}

export async function recordExerciseUsage(exerciseId: string): Promise<void> {
  await api.post(`/library/exercises/${exerciseId}/usage`);
}

export async function createExercise(input: {
  name: string;
  nameEn: string | null;
  description: string | null;
  muscleGroup: string;
}): Promise<{ id: string }> {
  return api.post<{ id: string }>("/library/exercises", {
    name: input.name,
    name_en: input.nameEn,
    description: input.description,
    muscle_group: input.muscleGroup,
  });
}
