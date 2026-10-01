export const SOCIAL_KEYS = ["instagram", "telegram", "website"] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

export interface PricingRow {
  title: string;
  priceToman: number;
  description: string;
}

export type VerificationStatus = "none" | "pending" | "verified" | "rejected";

/** The admin's check of the certificates; null before the phase-10 database update. */
export interface ResumeVerification {
  status: VerificationStatus;
  /** The admin's reason, on a rejection. */
  note: string | null;
  requested_at: string | null;
  verified_at: string | null;
}

export interface TrainerResume {
  bio: string | null;
  achievements: string[];
  certificates: string[];
  pricingTable: PricingRow[];
  socialLinks: Partial<Record<SocialKey, string>>;
  /** Only on the trainer's own résumé. */
  verification?: ResumeVerification | null;
}

/** What an athlete sees: the résumé plus whose it is. */
export interface TrainerResumeView extends TrainerResume {
  trainerId: string;
  trainerName: string;
  trainerAvatarUrl: string | null;
  trainerVerified: boolean;
}
