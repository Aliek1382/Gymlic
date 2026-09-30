import type { PlanInvoiceSummary } from "@/features/invoices/types/invoice-types";

export type QuestionType = "text" | "multiple_choice" | "number";

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  /** Only multiple_choice questions have options. */
  options: string[] | null;
  isRequired: boolean;
}

/** A question as the builder edits it: not saved yet, so no id, and options are always a list. */
export interface QuestionDraft {
  key: string;
  type: QuestionType;
  label: string;
  options: string[];
  isRequired: boolean;
}

export interface Questionnaire {
  id: string;
  title: string;
  description: string | null;
  /** null = free. */
  priceToman: number | null;
  isActive: boolean;
  assignedCount: number;
  submittedCount: number;
  questions: Question[];
  createdAt: string;
}

export interface SaveQuestionnaireInput {
  /** Set to edit an existing questionnaire. */
  id?: string;
  title: string;
  description: string | null;
  priceToman: number | null;
  /** Left out when editing a questionnaire that already has responses — the API refuses to replace those. */
  questions?: QuestionDraft[];
}

export interface AnswerValue {
  questionId: string;
  value: string | null;
}

/** One questionnaire sent to the signed-in athlete. */
export interface MyQuestionnaire {
  id: string;
  title: string;
  description: string | null;
  trainerName: string;
  status: "assigned" | "submitted";
  submittedAt: string | null;
  createdAt: string;
  /** A pending invoice hides the questions until the trainer records the payment. */
  locked: boolean;
  invoice: PlanInvoiceSummary | null;
  questions: Question[];
  answers: AnswerValue[];
}

export interface QuestionnaireResponse {
  id: string;
  athleteId: string;
  athleteName: string;
  submittedAt: string;
  answers: AnswerValue[];
}

export interface QuestionnaireResponses {
  title: string;
  questions: Question[];
  responses: QuestionnaireResponse[];
}
