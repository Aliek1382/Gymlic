export interface MeasurementEntry {
  id: string;
  athleteId: string;
  recordedBy: string | null;
  heightCm: number | null;
  weightKg: number | null;
  bodyFatPercent: number | null;
  waistCm: number | null;
  chestCm: number | null;
  note: string | null;
  recordedAt: string;
}

export interface MeasurementInput {
  heightCm: number | null;
  weightKg: number | null;
  bodyFatPercent: number | null;
  waistCm: number | null;
  chestCm: number | null;
  note: string | null;
}
