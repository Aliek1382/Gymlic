import type { Queued } from "@/lib/offline-queue";
import { api, query, type ListResponse } from "@/lib/api/client";
import type { Note } from "../types/note-types";

interface NoteRow {
  id: string;
  athlete_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** One athlete's notes, or — with a null `athleteId` — the trainer's general ones. */
export async function listNotes(athleteId: string | null): Promise<Note[]> {
  const data = await api.get<ListResponse<NoteRow>>(`/notes${query({ athlete_id: athleteId })}`);
  return data.items.map(toNote);
}

export async function createNote(input: {
  athleteId: string | null;
  content: string;
}): Promise<void | Queued> {
  return api.queueable.post("/notes", { athlete_id: input.athleteId, content: input.content });
}

export async function updateNote(input: { id: string; content: string }): Promise<void | Queued> {
  return api.queueable.patch(`/notes/${input.id}`, { content: input.content });
}

export async function deleteNote(id: string): Promise<void> {
  await api.delete(`/notes/${id}`);
}
