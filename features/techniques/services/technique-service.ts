import { api, type ListResponse } from "@/lib/api/client";
import type { Technique } from "../types/technique-types";

interface TechniqueRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export async function listTechniques(): Promise<Technique[]> {
  const data = await api.get<ListResponse<TechniqueRow>>("/techniques");

  return data.items.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
  }));
}

export async function createTechnique(input: {
  name: string;
  description: string | null;
}): Promise<{ id: string }> {
  return api.post<{ id: string }>("/techniques", {
    name: input.name,
    description: input.description,
  });
}
