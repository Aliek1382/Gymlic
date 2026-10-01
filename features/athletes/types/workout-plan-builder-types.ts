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
  // The trainer's technique for this exercise, if one was picked. Name and
  // description come joined in so a plan never needs a second request.
  techniqueId: string | null;
  techniqueName: string | null;
  techniqueDescription: string | null;
  sortOrder: number;
  /** The library's how-to image and video for this exercise, if the admin set them. */
  imageUrl?: string | null;
  videoUrl?: string | null;
}

export interface WorkoutPlanDay {
  id: string;
  weekNumber: number;
  dayNumber: number;
  dayName: string | null;
  sortOrder: number;
  exercises: WorkoutPlanExerciseEntry[];
}
