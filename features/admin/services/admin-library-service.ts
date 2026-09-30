import { api, query } from "@/lib/api/client";

export type LibraryKind = "exercises" | "foods" | "supplements";
export type LibraryScope = "public" | "custom";

export interface AdminLibraryEntry {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  /** null = the shared bank; otherwise the trainer who added it for themselves. */
  created_by: string | null;
  created_at: string;
  is_hidden: boolean;
  creator_first_name: string | null;
  creator_last_name: string | null;
  /** How many plan rows use it — an entry in use can be hidden but not deleted. */
  plan_usage: number;
  // exercises
  muscle_group?: string;
  // foods
  category?: string;
  default_unit?: string;
  calories_per_unit?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
}

export interface AdminLibraryList {
  items: AdminLibraryEntry[];
  public_count: number;
  custom_count: number;
  /** False until library-hidden-update.sql has been run. */
  hide_ready: boolean;
}

export function listAdminLibrary(kind: LibraryKind, scope: LibraryScope, q: string) {
  return api.get<AdminLibraryList>(`/admin/library/${kind}${query({ scope, q })}`);
}

/** Only the fields the kind has; text fields send null to clear them. */
export interface LibraryEntryInput {
  name: string;
  name_en: string | null;
  description: string | null;
  muscle_group?: string;
  category?: string;
  default_unit?: string;
  calories_per_unit?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
}

export async function createLibraryEntry(kind: LibraryKind, input: LibraryEntryInput) {
  await api.post(`/admin/library/${kind}`, input);
}

export async function updateLibraryEntry(
  kind: LibraryKind,
  id: string,
  input: Partial<LibraryEntryInput> & { is_hidden?: boolean }
) {
  await api.patch(`/admin/library/${kind}/${id}`, input);
}

export async function deleteLibraryEntry(kind: LibraryKind, id: string) {
  await api.delete(`/admin/library/${kind}/${id}`);
}

export async function publishLibraryEntry(kind: LibraryKind, id: string) {
  await api.post(`/admin/library/${kind}/${id}/publish`);
}
