"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/get-error-message";
import type { ClubStatus } from "@/types/database.types";
import { setClubStatus } from "../services/admin-service";

export function ClubStatusToggle({
  clubId,
  status,
}: {
  clubId: string;
  status: ClubStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next: ClubStatus = status === "active" ? "suspended" : "active";
    startTransition(async () => {
      try {
        await setClubStatus(clubId, next);
        toast.success(next === "active" ? "باشگاه فعال شد." : "باشگاه معلق شد.");
        router.refresh();
      } catch (error) {
        toast.error(getErrorMessage(error, "خطا در تغییر وضعیت باشگاه."));
      }
    });
  }

  return (
    <Button
      variant={status === "active" ? "destructive" : "default"}
      onClick={toggle}
      disabled={isPending}
    >
      {isPending && <Loader2 className="animate-spin" />}
      {status === "active" ? "معلق‌سازی باشگاه" : "فعال‌سازی باشگاه"}
    </Button>
  );
}
