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
}

export interface SessionContext {
  isAuthenticated: boolean;
  profile: Profile | null;
  activeClubId: string | null;
  hasClub: boolean;
  hasTrainer: boolean;
}
