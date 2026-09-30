import { api } from "@/lib/api/client";

export interface PointRule {
  action_type: string;
  label: string;
  points: number;
  is_active: boolean;
}

export interface PointLevel {
  name: string;
  min_points: number;
}

export interface PointsLeader {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  total_points: number;
  last_award_at: string | null;
  level: string;
}

export interface AdminPointsOverview {
  rules: PointRule[];
  levels: PointLevel[];
  /** False until app_settings exists (phase-1 SQL): levels can't be saved yet. */
  levels_ready: boolean;
  leaderboard: PointsLeader[];
}

export function getAdminPoints() {
  return api.get<AdminPointsOverview>("/admin/points");
}

export async function updatePointRule(
  actionType: string,
  input: Partial<Pick<PointRule, "label" | "points" | "is_active">>
) {
  await api.patch(`/admin/points/rules/${encodeURIComponent(actionType)}`, input);
}

/** Levels live in app_settings, saved through the generic settings endpoint. */
export async function savePointLevels(levels: PointLevel[]): Promise<PointLevel[]> {
  const data = await api.put<{ value: { levels: PointLevel[] } }>("/admin/settings/points_levels", {
    value: { levels },
  });
  return data.value.levels;
}

export async function adjustCoachPoints(coachId: string, points: number) {
  await api.post("/admin/points/adjust", { coach_id: coachId, points });
}
