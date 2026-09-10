export interface FoodSummary {
  id: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  category: string;
  defaultUnit: string;
  isCustom: boolean;
  createdAt: string;
}

export interface FoodPickerItem {
  id: string;
  name: string;
  nameEn: string | null;
  category: string;
  defaultUnit: string;
  isCustom: boolean;
  usageCount: number;
}
