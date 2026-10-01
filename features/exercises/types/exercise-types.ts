export interface ExerciseSummary {
  id: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  muscleGroup: string;
  isCustom: boolean;
  createdAt: string;
  /** How-to image / video the admin set in the library (phase 8). */
  imageUrl: string | null;
  videoUrl: string | null;
}

export interface ExercisePickerItem {
  id: string;
  name: string;
  nameEn: string | null;
  muscleGroup: string;
  isCustom: boolean;
  usageCount: number;
}
