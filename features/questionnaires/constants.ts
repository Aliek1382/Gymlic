import type { QuestionType } from "./types/questionnaire-types";

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  text: "متن آزاد",
  multiple_choice: "چندگزینه‌ای",
  number: "عدد",
};

/** Mirror the API's bounds. */
export const MAX_QUESTIONS = 100;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 50;
