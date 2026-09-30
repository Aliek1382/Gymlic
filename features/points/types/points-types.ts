export interface PointLevel {
  name: string;
  minPoints: number;
  nextLevel: string | null;
  nextMinPoints: number | null;
}

export interface PointLog {
  id: string;
  actionType: string;
  label: string;
  points: number;
  createdAt: string;
}

export interface MyPoints {
  totalPoints: number;
  level: PointLevel;
  /** null at the top level. */
  pointsToNextLevel: number | null;
  recentLogs: PointLog[];
}
