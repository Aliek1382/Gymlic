import { BadgeCheck } from "lucide-react";

import { cn } from "@/lib/utils";

/** «مربی تأییدشده»: an admin checked this trainer's certificates (see TrainerVerification). */
export function VerifiedTrainerBadge({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-success-muted px-2 py-0.5 text-[11px] font-medium text-success",
        className
      )}
      title="مدارک این مربی توسط جیم‌لیک بررسی و تأیید شده است."
    >
      <BadgeCheck className="size-3.5" />
      {!compact && "مربی تأییدشده"}
    </span>
  );
}
