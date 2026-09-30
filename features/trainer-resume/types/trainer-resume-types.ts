export const SOCIAL_KEYS = ["instagram", "telegram", "website"] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

export interface PricingRow {
  title: string;
  priceToman: number;
  description: string;
}

export interface TrainerResume {
  bio: string | null;
  achievements: string[];
  certificates: string[];
  pricingTable: PricingRow[];
  socialLinks: Partial<Record<SocialKey, string>>;
}

/** What an athlete sees: the résumé plus whose it is. */
export interface TrainerResumeView extends TrainerResume {
  trainerId: string;
  trainerName: string;
  trainerAvatarUrl: string | null;
}
