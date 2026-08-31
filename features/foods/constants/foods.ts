// The units a trainer picks from when adding a food to a nutrition plan.
// A custom food can carry a unit outside this list (the add dialog takes it
// as free text), so the picker unions the selected food's own unit in
// rather than treating this as a closed set.
export const FOOD_UNITS = [
  "گرم",
  "کیلوگرم",
  "میلی‌لیتر",
  "لیتر",
  "عدد",
  "لیوان",
  "فنجان",
  "قاشق غذاخوری",
  "قاشق چای‌خوری",
  "اسکوپ",
  "برش",
  "تکه",
  "مشت",
  "بسته",
] as const;
