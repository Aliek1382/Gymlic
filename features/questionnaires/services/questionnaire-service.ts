import { api, fullName, type ListResponse } from "@/lib/api/client";
import type {
  AnswerValue,
  MyQuestionnaire,
  Question,
  QuestionType,
  Questionnaire,
  QuestionnaireResponses,
  SaveQuestionnaireInput,
} from "../types/questionnaire-types";
import type { PlanInvoiceSummary } from "@/features/invoices/types/invoice-types";

interface QuestionRow {
  id: string;
  type: QuestionType;
  label: string;
  options: string[] | null;
  is_required: boolean;
}

interface AnswerRow {
  question_id: string;
  value: string | null;
}

interface QuestionnaireRow {
  id: string;
  title: string;
  description: string | null;
  price_toman: number | null;
  is_active: boolean;
  assigned_count: number;
  submitted_count: number;
  questions: QuestionRow[];
  created_at: string;
}

interface MineRow {
  id: string;
  title: string;
  description: string | null;
  trainer_first_name: string | null;
  trainer_last_name: string | null;
  status: "assigned" | "submitted";
  submitted_at: string | null;
  created_at: string;
  locked: boolean;
  invoice: { id: string; number: string; amount_toman: number } | null;
  questions: QuestionRow[];
  answers: AnswerRow[];
}

interface ResponsesData {
  questionnaire: { id: string; title: string };
  questions: QuestionRow[];
  items: {
    id: string;
    athlete_id: string;
    athlete_first_name: string | null;
    athlete_last_name: string | null;
    submitted_at: string;
    answers: AnswerRow[];
  }[];
}

function toQuestion(row: QuestionRow): Question {
  return {
    id: row.id,
    type: row.type,
    label: row.label,
    options: row.options,
    isRequired: row.is_required,
  };
}

function toAnswer(row: AnswerRow): AnswerValue {
  return { questionId: row.question_id, value: row.value };
}

function toInvoice(row: MineRow["invoice"]): PlanInvoiceSummary | null {
  return row ? { id: row.id, number: row.number, amountToman: row.amount_toman } : null;
}

export async function listQuestionnaires(): Promise<Questionnaire[]> {
  const data = await api.get<ListResponse<QuestionnaireRow>>("/questionnaires");
  return data.items.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    priceToman: row.price_toman,
    isActive: row.is_active,
    assignedCount: row.assigned_count,
    submittedCount: row.submitted_count,
    questions: row.questions.map(toQuestion),
    createdAt: row.created_at,
  }));
}

export async function saveQuestionnaire(input: SaveQuestionnaireInput): Promise<void> {
  const body: Record<string, unknown> = {
    title: input.title,
    description: input.description,
    price_toman: input.priceToman,
  };
  if (input.questions) {
    body.questions = input.questions.map((question) => ({
      type: question.type,
      label: question.label,
      options: question.type === "multiple_choice" ? question.options : null,
      is_required: question.isRequired,
    }));
  }

  if (input.id) {
    await api.patch(`/questionnaires/${input.id}`, body);
  } else {
    await api.post("/questionnaires", body);
  }
}

export async function setQuestionnaireActive(id: string, isActive: boolean): Promise<void> {
  await api.patch(`/questionnaires/${id}`, { is_active: isActive });
}

export async function deleteQuestionnaire(id: string): Promise<void> {
  await api.delete(`/questionnaires/${id}`);
}

export async function assignQuestionnaire(input: {
  questionnaireId: string;
  athleteId: string;
}): Promise<void> {
  await api.post(`/questionnaires/${input.questionnaireId}/assign`, {
    athlete_id: input.athleteId,
  });
}

export async function listMyQuestionnaires(): Promise<MyQuestionnaire[]> {
  const data = await api.get<ListResponse<MineRow>>("/questionnaires/mine");
  return data.items.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    trainerName: fullName(row.trainer_first_name, row.trainer_last_name, "مربی"),
    status: row.status,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    locked: row.locked,
    invoice: toInvoice(row.invoice),
    questions: row.questions.map(toQuestion),
    answers: row.answers.map(toAnswer),
  }));
}

export async function submitQuestionnaire(input: {
  responseId: string;
  answers: AnswerValue[];
}): Promise<void> {
  await api.post(`/questionnaires/responses/${input.responseId}/submit`, {
    answers: input.answers.map((answer) => ({
      question_id: answer.questionId,
      value: answer.value,
    })),
  });
}

export async function getQuestionnaireResponses(id: string): Promise<QuestionnaireResponses> {
  const data = await api.get<ResponsesData>(`/questionnaires/${id}/responses`);
  return {
    title: data.questionnaire.title,
    questions: data.questions.map(toQuestion),
    responses: data.items.map((row) => ({
      id: row.id,
      athleteId: row.athlete_id,
      athleteName: fullName(row.athlete_first_name, row.athlete_last_name, "ورزشکار"),
      submittedAt: row.submitted_at,
      answers: row.answers.map(toAnswer),
    })),
  };
}
