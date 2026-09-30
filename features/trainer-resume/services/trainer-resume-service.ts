import { api, fullName } from "@/lib/api/client";
import type {
  PricingRow,
  SocialKey,
  TrainerResume,
  TrainerResumeView,
} from "../types/trainer-resume-types";

interface ResumeRow {
  bio: string | null;
  achievements: string[];
  certificates: string[];
  pricing_table: { title: string; price_toman: number; description: string }[];
  social_links: Partial<Record<SocialKey, string>>;
}

function mapResume(row: ResumeRow): TrainerResume {
  return {
    bio: row.bio,
    achievements: row.achievements,
    certificates: row.certificates,
    pricingTable: row.pricing_table.map((item) => ({
      title: item.title,
      priceToman: Number(item.price_toman),
      description: item.description ?? "",
    })),
    socialLinks: row.social_links,
  };
}

/** The trainer's own résumé, for editing. Empty (not an error) until first saved. */
export async function getMyResume(): Promise<TrainerResume> {
  return mapResume(await api.get<ResumeRow>("/trainer-profile"));
}

export async function saveMyResume(input: TrainerResume): Promise<TrainerResume> {
  const row = await api.put<ResumeRow>("/trainer-profile", {
    bio: input.bio,
    achievements: input.achievements,
    certificates: input.certificates,
    pricing_table: input.pricingTable.map((item: PricingRow) => ({
      title: item.title,
      price_toman: item.priceToman,
      description: item.description,
    })),
    social_links: input.socialLinks,
  });
  return mapResume(row);
}

/** Uploads one certificate photo; the URL only counts once the résumé is saved with it. */
export async function uploadCertificate(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("فقط فایل تصویری مجاز است.");
  }
  const data = await api.upload<{ url: string }>("/trainer-profile/certificates", file);
  return data.url;
}

/** An athlete reading their own trainer's résumé; 404 if that trainer isn't theirs. */
export async function getTrainerResume(trainerId: string): Promise<TrainerResumeView> {
  const data = await api.get<
    ResumeRow & {
      trainer: {
        id: string;
        first_name: string | null;
        last_name: string | null;
        avatar_url: string | null;
      };
    }
  >(`/trainer-profile/${trainerId}`);

  return {
    ...mapResume(data),
    trainerId: data.trainer.id,
    trainerName: fullName(data.trainer.first_name, data.trainer.last_name, "مربی"),
    trainerAvatarUrl: data.trainer.avatar_url,
  };
}
