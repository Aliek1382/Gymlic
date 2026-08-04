export interface ExerciseSummary {
  id: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  muscleGroup: string;
  isCustom: boolean;
  createdAt: string;
}
