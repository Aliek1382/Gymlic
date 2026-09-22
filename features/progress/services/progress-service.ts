import { api, type ListResponse } from "@/lib/api/client";
import type { MeasurementEntry, MeasurementInput } from "../types/progress-types";

interface MeasurementRow {
  id: string;
  athlete_id: string;
  recorded_by: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  body_fat_percent: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  note: string | null;
  recorded_at: string;
}

function mapRow(row: MeasurementRow): MeasurementEntry {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    recordedBy: row.recorded_by,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    bodyFatPercent: row.body_fat_percent,
    waistCm: row.waist_cm,
    chestCm: row.chest_cm,
    note: row.note,
    recordedAt: row.recorded_at,
  };
}

function toPayload(input: MeasurementInput) {
  return {
    height_cm: input.heightCm,
    weight_kg: input.weightKg,
    body_fat_percent: input.bodyFatPercent,
    waist_cm: input.waistCm,
    chest_cm: input.chestCm,
    note: input.note,
  };
}

// Oldest-first — the shape charts and "latest known height" both want.
export async function listMeasurements(athleteId: string): Promise<MeasurementEntry[]> {
  const data = await api.get<ListResponse<MeasurementRow>>(
    `/athletes/${athleteId}/measurements`
  );
  return data.items.map(mapRow);
}

export async function addMeasurement(
  athleteId: string,
  input: MeasurementInput
): Promise<{ id: string }> {
  return api.post<{ id: string }>(`/athletes/${athleteId}/measurements`, toPayload(input));
}

export async function updateMeasurement(
  id: string,
  input: MeasurementInput
): Promise<void> {
  await api.patch(`/measurements/${id}`, toPayload(input));
}
