export type SupplementTiming =
  | "before_workout"
  | "after_workout"
  | "breakfast"
  | "lunch"
  | "dinner"
  | "before_sleep"
  | "custom";

export type SupplementPlanStatus = "active" | "completed" | "cancelled";

export interface SupplementSummary {
  id: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  imageUrl: string | null;
  isCustom: boolean;
  createdAt: string;
}

export interface SupplementPickerItem {
  id: string;
  name: string;
  nameEn: string | null;
  isCustom: boolean;
  usageCount: number;
}

/** One line of a plan, as the trainer is editing it or as the API returns it. */
export interface SupplementPlanItemInput {
  supplementId: string;
  supplementName: string;
  dose: string;
  timing: SupplementTiming;
  /** "HH:MM". Required for "custom"; optional for before/after workout (it is what the reminder fires at). */
  customTime: string | null;
  note: string | null;
}

export interface SupplementPlanItem extends SupplementPlanItemInput {
  id: string;
  supplementNameEn: string | null;
}

export interface SupplementPlan {
  id: string;
  athleteId: string;
  trainerName: string;
  title: string;
  status: SupplementPlanStatus;
  items: SupplementPlanItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SaveSupplementPlanInput {
  title: string;
  items: SupplementPlanItemInput[];
}
