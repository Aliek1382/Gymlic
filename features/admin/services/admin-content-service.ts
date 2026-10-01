import { api, query } from "@/lib/api/client";
import type {
  ContentDetail,
  ContentKind,
  ContentLists,
} from "@/features/content-library/services/content-library-service";
import type { SaveQuestionnaireInput } from "@/features/questionnaires/types/questionnaire-types";

export interface ContentCandidate {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  owner_name: string;
  /** workout: days · nutrition: meals · questionnaire: questions */
  days: number | null;
}

export function listAdminContent() {
  return api.get<ContentLists>("/admin/content");
}

/** Any item, public or a trainer's — for previewing before publishing. */
export function getAdminContentItem(kind: ContentKind, id: string) {
  return api.get<ContentDetail>(`/admin/content/${kind}/${id}`);
}

export async function listContentCandidates(kind: ContentKind, q: string) {
  const data = await api.get<{ items: ContentCandidate[] }>(`/admin/content/candidates${query({ kind, q })}`);
  return data.items;
}

export function publishContent(kind: ContentKind, sourceId: string) {
  return api.post<{ id: string }>(`/admin/content/${kind}/publish`, { source_id: sourceId });
}

export function createTechnique(name: string, description: string) {
  return api.post<{ id: string }>("/admin/content/technique", { name, description });
}

export async function updateContent(kind: ContentKind, id: string, title: string, description: string) {
  await api.patch(`/admin/content/${kind}/${id}`, kind === "technique" ? { name: title, description } : { title, description });
}

/** The builder's input, in the API's shape. Public questionnaires are never priced. */
function questionPayload(input: SaveQuestionnaireInput) {
  return {
    title: input.title,
    description: input.description,
    ...(input.questions
      ? {
          questions: input.questions.map((q) => ({
            type: q.type,
            label: q.label,
            options: q.type === "multiple_choice" ? q.options : null,
            is_required: q.isRequired,
          })),
        }
      : {}),
  };
}

export async function savePublicQuestionnaire(input: SaveQuestionnaireInput) {
  if (input.id) {
    await api.patch(`/admin/content/questionnaire/${input.id}`, questionPayload(input));
  } else {
    await api.post("/admin/content/questionnaire", questionPayload(input));
  }
}

export async function deleteContent(kind: ContentKind, id: string) {
  await api.delete(`/admin/content/${kind}/${id}`);
}
