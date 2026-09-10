"use client";

import { useState } from "react";
import { MoreVertical, Pause, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getErrorMessage } from "@/lib/get-error-message";
import { useRemoveTrainer } from "../hooks/use-remove-trainer";
import { useUpdateTrainerStatus } from "../hooks/use-update-trainer-status";
import type { ClubTrainer } from "../types/trainer-types";

export function TrainerRowActions({ trainer }: { trainer: ClubTrainer }) {
  const [removeOpen, setRemoveOpen] = useState(false);
  const updateStatus = useUpdateTrainerStatus();
  const removeTrainer = useRemoveTrainer();

  const isSuspended = trainer.status === "suspended";

  async function toggleSuspended() {
    try {
      await updateStatus.mutateAsync({
        membershipId: trainer.membershipId,
        status: isSuspended ? "active" : "suspended",
      });
      toast.success(isSuspended ? "همکاری مربی فعال شد." : "همکاری مربی معلق شد.");
    } catch (error) {
      toast.error(getErrorMessage(error, "تغییر وضعیت با خطا مواجه شد."));
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label={`عملیات ${trainer.name}`}>
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onSelect={toggleSuspended}
            disabled={updateStatus.isPending}
          >
            {isSuspended ? <Play /> : <Pause />}
            {isSuspended ? "فعال‌سازی همکاری" : "تعلیق همکاری"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setRemoveOpen(true)}
          >
            <Trash2 />
            حذف از باشگاه
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={`حذف ${trainer.name} از باشگاه`}
        description="همکاری این مربی با باشگاه شما پایان می‌یابد و دیگر به اطلاعات باشگاه دسترسی ندارد. حساب کاربری، شاگردان و برنامه‌های او حذف نمی‌شوند و شاگردانش همچنان عضو باشگاه می‌مانند."
        confirmLabel="بله، حذف کن"
        errorMessage="حذف مربی با خطا مواجه شد."
        onConfirm={() => removeTrainer.mutateAsync(trainer.membershipId)}
      />
    </>
  );
}
