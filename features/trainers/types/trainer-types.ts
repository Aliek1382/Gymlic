import type { MembershipStatus } from "@/types/database.types";

export interface ClubTrainer {
  membershipId: string;
  userId: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  status: MembershipStatus;
  joinedAt: string;
  /** Athletes this trainer works with inside this club. */
  athleteCount: number;
}

export interface PendingTrainerInvite {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface CreateTrainerInviteInput {
  clubId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
}
