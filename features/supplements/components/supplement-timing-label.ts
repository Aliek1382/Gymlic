import { toPersianDigits } from "@/lib/persian";
import { FIXED_REMINDER_TIME, TIMING_LABEL } from "../constants";
import type { SupplementPlanItemInput } from "../types/supplement-types";

/** "بعد از تمرین · ساعت ۱۸:۰۰" — the reminder time is shown only when there is one. */
export function describeTiming(item: Pick<SupplementPlanItemInput, "timing" | "customTime">): string {
  const time = item.customTime ?? FIXED_REMINDER_TIME[item.timing] ?? null;
  const label = TIMING_LABEL[item.timing];
  return time ? `${label} · ساعت ${toPersianDigits(time)}` : label;
}
