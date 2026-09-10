import type { badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

// Muscle groups are free text (trainers can add their own), so colors can't
// be hand-mapped per name — instead, the same group name always hashes to
// the same badge variant, giving each group a stable, distinct color.
const PALETTE: BadgeVariant[] = [
  "default",
  "info",
  "success",
  "warning",
  "destructive",
  "secondary",
];

export function getMuscleGroupBadgeVariant(muscleGroup: string): BadgeVariant {
  let hash = 0;
  for (let i = 0; i < muscleGroup.length; i++) {
    hash = (hash * 31 + muscleGroup.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
