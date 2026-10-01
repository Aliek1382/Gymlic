import { api } from "@/lib/api/client";

export type ContentKind = "workout" | "nutrition" | "technique" | "questionnaire";

export const CONTENT_KINDS: ContentKind[] = ["workout", "nutrition", "technique", "questionnaire"];

export const CONTENT_KIND_LABEL: Record<ContentKind, string> = {
  workout: "قالب تمرینی",
  nutrition: "قالب غذایی",
  technique: "تکنیک",
  questionnaire: "پرسشنامه",
};

export interface ContentItem {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  /** workout: weeks; */
  weeks?: number;
  /** workout: days · nutrition: meals */
  days?: number;
  /** workout: exercises · nutrition: foods · questionnaire: questions */
  items?: number;
}

export type ContentLists = { ready: boolean } & Record<ContentKind, ContentItem[]>;

export interface ContentDetail {
  id: string;
  title: string;
  description: string | null;
  days?: {
    id: string;
    week_number: number;
    day_number: number;
    day_name: string | null;
    exercises: {
      id: string;
      exercise_name: string;
      sets: number | null;
      reps: string | null;
      technique_name: string | null;
      image_url?: string | null;
      video_url?: string | null;
    }[];
  }[];
  meals?: { id: string; meal_name: string; items: { food_name: string; amount: number | null; unit: string | null; note: string | null }[] }[];
  questions?: { id: string; type: "text" | "multiple_choice" | "number"; label: string; options: string[] | null; is_required: boolean }[];
}

export function listContentLibrary() {
  return api.get<ContentLists>("/content-library");
}

export function getContentItem(kind: ContentKind, id: string) {
  return api.get<ContentDetail>(`/content-library/${kind}/${id}`);
}

export function copyContentItem(kind: ContentKind, id: string) {
  return api.post<{ id: string }>(`/content-library/${kind}/${id}/copy`);
}

export function copyAllTechniques() {
  return api.post<{ added: number }>("/content-library/technique/copy-all");
}
