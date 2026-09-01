import type { MembershipPlanTier, MembershipStatus } from "@/types/database.types";

export interface ClubMember {
  membershipId: string;
  userId: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  planTier: MembershipPlanTier;
  status: MembershipStatus;
  joinedAt: string;
}

export interface PendingMemberInvite {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  planTier: MembershipPlanTier;
  trainerId: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface ClubTrainerOption {
  id: string;
  name: string;
}

/** Active athlete count against the cap the club's plan allows (null = unlimited). */
export interface ClubCapacity {
  activeMembers: number;
  capacity: number | null;
}

export interface CreateMemberInviteInput {
  clubId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  planTier: MembershipPlanTier;
  /** Optional: one of the club's own trainers, linked on accept. */
  trainerId: string | null;
}

export interface UpdateMembershipInput {
  membershipId: string;
  planTier?: MembershipPlanTier;
  status?: MembershipStatus;
}
