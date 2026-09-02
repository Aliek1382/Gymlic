export interface ClubProfile {
  id: string;
  name: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  workingHours: string | null;
  memberCapacity: number | null;
}

export interface ClubProfileInput {
  name: string;
  address: string | null;
  phone: string | null;
  workingHours: string | null;
}

/** A plan the club itself defines and sells — not a platform-wide tier. */
export interface MembershipPlan {
  id: string;
  name: string;
  priceToman: number;
  durationDays: number;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  /** Active memberships currently on this plan. */
  memberCount: number;
}

export interface MembershipPlanInput {
  name: string;
  priceToman: number;
  durationDays: number;
  description: string | null;
  isActive: boolean;
}
