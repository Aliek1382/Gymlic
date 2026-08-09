import { createClient } from "@/lib/supabase/client";
import type { MeasurementEntry, MeasurementInput } from "../types/progress-types";

const SELECT_COLUMNS =
  "id, athlete_id, recorded_by, height_cm, weight_kg, body_fat_percent, waist_cm, chest_cm, note, recorded_at";

async function getCurrentUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("نشست کاربر معتبر نیست.");
  return user.id;
}

function mapRow(row: {
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
}): MeasurementEntry {
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

// Oldest-first — the shape charts and "latest known height" both want.
export async function listMeasurements(athleteId: string): Promise<MeasurementEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("measurements")
    .select(SELECT_COLUMNS)
    .eq("athlete_id", athleteId)
    .order("recorded_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function addMeasurement(
  athleteId: string,
  input: MeasurementInput
): Promise<{ id: string }> {
  const supabase = createClient();
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("measurements")
    .insert({
      athlete_id: athleteId,
      recorded_by: userId,
      height_cm: input.heightCm,
      weight_kg: input.weightKg,
      body_fat_percent: input.bodyFatPercent,
      waist_cm: input.waistCm,
      chest_cm: input.chestCm,
      note: input.note,
    })
    .select("id")
    .single();
  if (error) throw error;

  return { id: data.id };
}

// .select().single() after the update forces an error when RLS silently
// excluded the row (i.e. someone else's entry) instead of quietly no-op'ing.
export async function updateMeasurement(
  id: string,
  input: MeasurementInput
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("measurements")
    .update({
      height_cm: input.heightCm,
      weight_kg: input.weightKg,
      body_fat_percent: input.bodyFatPercent,
      waist_cm: input.waistCm,
      chest_cm: input.chestCm,
      note: input.note,
    })
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw error;
}
