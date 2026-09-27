import { api, type ListResponse } from "@/lib/api/client";
import type { WorkoutPlanDay, WorkoutPlanExerciseEntry } from "../types/workout-plan-builder-types";

interface ExerciseRow {
  id: string;
  day_id: string;
  exercise_id: string;
  sets: number | null;
  reps: string | null;
  weight_kg: number | null;
  rest_seconds: number | null;
  note: string | null;
  sort_order: number;
  exercise_name: string;
  exercise_name_en: string | null;
  muscle_group: string;
}

interface DayRow {
  id: string;
  week_number: number;
  day_number: number;
  day_name: string | null;
  sort_order: number;
  exercises: ExerciseRow[];
}

function toExercise(row: ExerciseRow): WorkoutPlanExerciseEntry {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    exerciseNameEn: row.exercise_name_en,
    muscleGroup: row.muscle_group,
    sets: row.sets,
    reps: row.reps,
    weightKg: row.weight_kg,
    restSeconds: row.rest_seconds,
    note: row.note,
    sortOrder: row.sort_order,
  };
}

function toDay(row: DayRow): WorkoutPlanDay {
  return {
    id: row.id,
    weekNumber: row.week_number,
    dayNumber: row.day_number,
    dayName: row.day_name,
    sortOrder: row.sort_order,
    exercises: row.exercises.map(toExercise),
  };
}

export async function listWorkoutPlanDays(assignmentId: string): Promise<WorkoutPlanDay[]> {
  const data = await api.get<ListResponse<DayRow>>(`/plans/workout/${assignmentId}/days`);
  return data.items.map(toDay);
}

export async function createWorkoutPlanDay(
  assignmentId: string,
  input: { weekNumber: number; dayNumber: number; dayName: string | null }
): Promise<{ id: string }> {
  return api.post<{ id: string }>(`/plans/workout/${assignmentId}/days`, {
    week_number: input.weekNumber,
    day_number: input.dayNumber,
    day_name: input.dayName,
  });
}

export async function updateWorkoutPlanDay(
  assignmentId: string,
  dayId: string,
  input: Partial<{ dayName: string | null; dayNumber: number; weekNumber: number }>
): Promise<void> {
  const body: Record<string, unknown> = {};
  if ("dayName" in input) body.day_name = input.dayName;
  if ("dayNumber" in input) body.day_number = input.dayNumber;
  if ("weekNumber" in input) body.week_number = input.weekNumber;
  await api.put(`/plans/workout/${assignmentId}/days/${dayId}`, body);
}

export async function deleteWorkoutPlanDay(assignmentId: string, dayId: string): Promise<void> {
  await api.delete(`/plans/workout/${assignmentId}/days/${dayId}`);
}

export async function addWorkoutPlanExercise(
  assignmentId: string,
  dayId: string,
  input: {
    exerciseId: string;
    sets: number | null;
    reps: string | null;
    weightKg: number | null;
    restSeconds: number | null;
    note: string | null;
  }
): Promise<{ id: string }> {
  return api.post<{ id: string }>(`/plans/workout/${assignmentId}/days/${dayId}/exercises`, {
    exercise_id: input.exerciseId,
    sets: input.sets,
    reps: input.reps,
    weight_kg: input.weightKg,
    rest_seconds: input.restSeconds,
    note: input.note,
  });
}

export async function updateWorkoutPlanExercise(
  assignmentId: string,
  dayId: string,
  exerciseRowId: string,
  input: Partial<{
    sets: number | null;
    reps: string | null;
    weightKg: number | null;
    restSeconds: number | null;
    note: string | null;
  }>
): Promise<void> {
  const body: Record<string, unknown> = {};
  if ("sets" in input) body.sets = input.sets;
  if ("reps" in input) body.reps = input.reps;
  if ("weightKg" in input) body.weight_kg = input.weightKg;
  if ("restSeconds" in input) body.rest_seconds = input.restSeconds;
  if ("note" in input) body.note = input.note;
  await api.patch(`/plans/workout/${assignmentId}/days/${dayId}/exercises/${exerciseRowId}`, body);
}

export async function deleteWorkoutPlanExercise(
  assignmentId: string,
  dayId: string,
  exerciseRowId: string
): Promise<void> {
  await api.delete(`/plans/workout/${assignmentId}/days/${dayId}/exercises/${exerciseRowId}`);
}

export async function copyWorkoutPlanDay(
  assignmentId: string,
  dayId: string,
  input: { dayNumber: number; weekNumber: number }
): Promise<{ id: string }> {
  return api.post<{ id: string }>(`/plans/workout/${assignmentId}/days/${dayId}/copy`, {
    day_number: input.dayNumber,
    week_number: input.weekNumber,
  });
}

export async function copyWorkoutPlanWeek(
  assignmentId: string,
  sourceWeekNumber: number,
  targetWeekNumber: number
): Promise<{ dayIds: string[] }> {
  return api.post<{ dayIds: string[] }>(`/plans/workout/${assignmentId}/weeks/${sourceWeekNumber}/copy`, {
    target_week_number: targetWeekNumber,
  });
}
