import type { MembershipStatus, RevenueCategory } from "@/types/database.types";

export interface ClubMember {
  membershipId: string;
  userId: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  planId: string | null;
  planName: string | null;
  status: MembershipStatus;
  joinedAt: string;
  /** "YYYY-MM-DD", or null for an open-ended membership. */
  expiresAt: string | null;
}

export interface PendingMemberInvite {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  planId: string | null;
  planName: string | null;
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
  planId: string | null;
  /** Optional: one of the club's own trainers, linked on accept. */
  trainerId: string | null;
}

export interface UpdateMembershipInput {
  membershipId: string;
  planId?: string | null;
  status?: MembershipStatus;
  /** null clears the end date; undefined leaves it as it is. */
  expiresAt?: string | null;
}

/** Everything the club sees on one member's profile page. */
export interface MemberProfile {
  member: ClubMember;
  trainers: { id: string; name: string }[];
  payments: {
    id: string;
    amount: number;
    category: RevenueCategory;
    occurredOn: string;
    note: string | null;
  }[];
  totalPaid: number;
  plans: {
    id: string;
    kind: "workout" | "nutrition";
    title: string;
    status: string;
    updatedAt: string;
  }[];
  measurements: {
    id: string;
    weightKg: number | null;
    heightCm: number | null;
    bodyFatPercent: number | null;
    recordedAt: string;
  }[];
  attendance: {
    id: string;
    attended: boolean;
    classDate: string;
  }[];
  attendanceRate: number | null;
}
