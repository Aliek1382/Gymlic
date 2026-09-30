import { api } from "@/lib/api/client";
import type { MyPoints } from "../types/points-types";

interface MyPointsResponse {
  total_points: number;
  current_level: {
    name: string;
    min_points: number;
    next_level: string | null;
    next_min_points: number | null;
  };
  points_to_next_level: number | null;
  recent_logs: {
    id: string;
    action_type: string;
    label: string;
    points: number;
    created_at: string;
  }[];
}

export async function getMyPoints(): Promise<MyPoints> {
  const data = await api.get<MyPointsResponse>("/points/me");
  return {
    totalPoints: data.total_points,
    level: {
      name: data.current_level.name,
      minPoints: data.current_level.min_points,
      nextLevel: data.current_level.next_level,
      nextMinPoints: data.current_level.next_min_points,
    },
    pointsToNextLevel: data.points_to_next_level,
    recentLogs: data.recent_logs.map((log) => ({
      id: log.id,
      actionType: log.action_type,
      label: log.label,
      points: log.points,
      createdAt: log.created_at,
    })),
  };
}
