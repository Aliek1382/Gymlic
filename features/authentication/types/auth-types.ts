import type { AccountType } from "@/types/database.types";

export interface Profile {
  id: string;
  phone: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  birthDate: string | null;
  accountType: AccountType | null;
  isPlatformAdmin: boolean;
  // Opt-in extra notification channels; the in-app bell is always on.
  notifySms: boolean;
  notifyEmail: boolean;
  // Athletes only: nutrition target. Null until set; the three percentages
  // are all set (adding up to 100) or all null.
  dailyCalorieGoal: number | null;
  proteinPercent: number | null;
  carbsPercent: number | null;
  fatPercent: number | null;
}

export interface SessionContext {
  isAuthenticated: boolean;
  profile: Profile | null;
  activeClubId: string | null;
  hasClub: boolean;
  hasTrainer: boolean;
}
