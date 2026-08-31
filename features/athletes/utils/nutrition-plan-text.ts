// The nutrition-plan counterpart of WEEKDAYS: a nutrition plan is organised
// by meal rather than by day, but the headings are written into the same
// free-text description through the same helpers in workout-plan-text.
export const MEALS = [
  "صبحانه",
  "میان‌وعده صبح",
  "ناهار",
  "میان‌وعده عصر",
  "شام",
  "قبل از تمرین",
  "بعد از تمرین",
] as const;

export type Meal = (typeof MEALS)[number];
