export interface WorkoutPlanExerciseEntry {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseNameEn: string | null;
  muscleGroup: string;
  sets: number | null;
  reps: string | null;
  weightKg: number | null;
  restSeconds: number | null;
  note: string | null;
  sortOrder: number;
}

export interface WorkoutPlanDay {
  id: string;
  weekNumber: number;
  dayNumber: number;
  dayName: string | null;
  sortOrder: number;
  exercises: WorkoutPlanExerciseEntry[];
}
