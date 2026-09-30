import { api, fullName, query, type ListResponse } from "@/lib/api/client";
import type {
  SaveSupplementPlanInput,
  SupplementPickerItem,
  SupplementPlan,
  SupplementPlanItem,
  SupplementPlanStatus,
  SupplementSummary,
  SupplementTiming,
} from "../types/supplement-types";

interface SupplementRow {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  image_url: string | null;
  created_by: string | null;
  created_at: string;
}

interface PlanItemRow {
  id: string;
  supplement_id: string;
  supplement_name: string;
  supplement_name_en: string | null;
  dose: string;
  timing: SupplementTiming;
  custom_time: string | null;
  note: string | null;
}

interface PlanRow {
  id: string;
  athlete_id: string;
  trainer_first_name: string | null;
  trainer_last_name: string | null;
  title: string;
  status: SupplementPlanStatus;
  items: PlanItemRow[];
  created_at: string;
  updated_at: string;
}

export async function listSupplements(): Promise<SupplementSummary[]> {
  const data = await api.get<ListResponse<SupplementRow>>("/library/supplements");

  return data.items.map((row) => ({
    id: row.id,
    name: row.name,
    nameEn: row.name_en,
    description: row.description,
    imageUrl: row.image_url,
    isCustom: row.created_by !== null,
    createdAt: row.created_at,
  }));
}

/** Already ordered most-used-first by the API, per trainer. */
export async function listSupplementsForPicker(): Promise<SupplementPickerItem[]> {
  const data = await api.get<
    ListResponse<Pick<SupplementRow, "id" | "name" | "name_en" | "created_by"> & { usage_count: number }>
  >("/library/supplements/picker");

  return data.items.map((row) => ({
    id: row.id,
    name: row.name,
    nameEn: row.name_en,
    isCustom: row.created_by !== null,
    usageCount: row.usage_count,
  }));
}

export async function recordSupplementUsage(supplementId: string): Promise<void> {
  await api.post(`/library/supplements/${supplementId}/usage`);
}

export async function createSupplement(input: {
  name: string;
  nameEn: string | null;
  description: string | null;
}): Promise<{ id: string }> {
  return api.post<{ id: string }>("/library/supplements", {
    name: input.name,
    name_en: input.nameEn,
    description: input.description,
  });
}

function toItem(row: PlanItemRow): SupplementPlanItem {
  return {
    id: row.id,
    supplementId: row.supplement_id,
    supplementName: row.supplement_name,
    supplementNameEn: row.supplement_name_en,
    dose: row.dose,
    timing: row.timing,
    customTime: row.custom_time,
    note: row.note,
  };
}

function toPlan(row: PlanRow): SupplementPlan {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    trainerName: fullName(row.trainer_first_name, row.trainer_last_name, "مربی"),
    title: row.title,
    status: row.status,
    items: row.items.map(toItem),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toItemsBody(input: SaveSupplementPlanInput) {
  return input.items.map((item) => ({
    supplement_id: item.supplementId,
    dose: item.dose,
    timing: item.timing,
    custom_time: item.customTime,
    note: item.note,
  }));
}

export async function createSupplementPlan(
  input: SaveSupplementPlanInput & { athleteId: string }
): Promise<{ id: string }> {
  return api.post<{ id: string }>("/supplement-plans", {
    athlete_id: input.athleteId,
    title: input.title,
    items: toItemsBody(input),
  });
}

/** The trainer's supplement plans for one athlete. */
export async function listSupplementPlans(athleteId: string): Promise<SupplementPlan[]> {
  const data = await api.get<ListResponse<PlanRow>>(
    `/supplement-plans${query({ athlete_id: athleteId })}`
  );
  return data.items.map(toPlan);
}

export async function listMySupplementPlans(): Promise<SupplementPlan[]> {
  const data = await api.get<ListResponse<PlanRow>>("/supplement-plans/mine");
  return data.items.map(toPlan);
}

/** Items replace the plan's whole list; leave `items` out to change only title/status. */
export async function updateSupplementPlan(input: {
  id: string;
  title?: string;
  status?: SupplementPlanStatus;
  items?: SaveSupplementPlanInput["items"];
}): Promise<void> {
  const body: Record<string, unknown> = {};
  if (input.title !== undefined) body.title = input.title;
  if (input.status !== undefined) body.status = input.status;
  if (input.items !== undefined) body.items = toItemsBody({ title: "", items: input.items });

  await api.patch(`/supplement-plans/${input.id}`, body);
}

export async function deleteSupplementPlan(id: string): Promise<void> {
  await api.delete(`/supplement-plans/${id}`);
}
