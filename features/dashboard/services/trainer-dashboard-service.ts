import { api, fullName } from "@/lib/api/client";
import type {
  TrainerActivityItem,
  TrainerDraftPlan,
  TrainerStatistics,
  UpcomingBirthday,
} from "../types/dashboard-types";

interface TrainerDashboardResponse {
  statistics: {
    athletes_count: number;
    active_workout_count: number;
    active_nutrition_count: number;
    completed_count: number;
  };
  activity: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    assigned_at: string;
    first_name: string | null;
    last_name: string | null;
    kind: "workout" | "nutrition";
  }[];
  drafts: {
    id: string;
    title: string;
    updated_at: string;
    athlete_first_name: string | null;
    athlete_last_name: string | null;
    invite_first_name: string | null;
    invite_last_name: string | null;
    kind: "workout" | "nutrition";
  }[];
  /** Absent from a backend older than the birthday reminder. */
  birthdays?: {
    athlete_id: string;
    first_name: string | null;
    last_name: string | null;
    date: string;
    days_left: number;
    age: number;
  }[];
}

/** Counts, recent activity and unfinished drafts in one request. */
export async function getTrainerDashboard(): Promise<{
  statistics: TrainerStatistics;
  activity: TrainerActivityItem[];
  drafts: TrainerDraftPlan[];
  birthdays: UpcomingBirthday[];
}> {
  const data = await api.get<TrainerDashboardResponse>("/dashboard/trainer");

  return {
    statistics: {
      athletesCount: data.statistics.athletes_count,
      activeWorkoutProgramsCount: data.statistics.active_workout_count,
      completedProgramsCount: data.statistics.completed_count,
      activeNutritionPlansCount: data.statistics.active_nutrition_count,
    },
    activity: data.activity.map((row) => ({
      id: `${row.kind}-${row.id}`,
      athleteName: fullName(row.first_name, row.last_name, "ورزشکار"),
      title: row.title,
      description: row.description,
      type: row.kind,
      status: row.status === "cancelled" ? "cancelled" : "active",
      date: row.assigned_at,
    })),
    drafts: data.drafts.map((row) => ({
      id: `${row.kind}-${row.id}`,
      // A draft can be aimed at a joined athlete or at a pending invitation.
      athleteName: fullName(
        row.athlete_first_name ?? row.invite_first_name,
        row.athlete_last_name ?? row.invite_last_name,
        "ورزشکار"
      ),
      title: row.title,
      description: null,
      type: row.kind,
      updatedAt: row.updated_at,
    })),
    birthdays: (data.birthdays ?? []).map((row) => ({
      athleteId: row.athlete_id,
      name: fullName(row.first_name, row.last_name, "ورزشکار"),
      date: row.date,
      daysLeft: row.days_left,
      age: row.age,
    })),
  };
}
