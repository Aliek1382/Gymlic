import { api } from "@/lib/api/client";

export interface TrainerBirthday {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  birth_date: string;
  /** "YYYY-MM-DD" of the day it falls on this year. */
  date: string;
  days_left: number;
  age: number;
  /** This year's birthday gift was already sent. */
  gifted: boolean;
}

/** The coming week's trainer birthdays. ready: false until a code can be tied to one trainer. */
export function listTrainerBirthdays(): Promise<{ ready: boolean; year: number; items: TrainerBirthday[] }> {
  return api.get("/admin/trainer-birthdays");
}

export interface GiftCodeInput {
  occasion: "birthday" | "gift";
  percent: number;
  days: number;
  message?: string;
}

/** A discount code only this trainer can use, once; sent to them as a notification. */
export function sendTrainerGiftCode(
  trainerId: string,
  input: GiftCodeInput
): Promise<{ code: string; percent: number; expires_at: string }> {
  return api.post(`/admin/trainers/${trainerId}/gift-code`, input);
}
