export interface ExerciseSummary {
  id: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  muscleGroup: string;
  isCustom: boolean;
  createdAt: string;
}

export interface ExercisePickerItem {
  id: string;
  name: string;
  nameEn: string | null;
  muscleGroup: string;
  isCustom: boolean;
  usageCount: number;
}
