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

  function setStatus(next: ClubStatus) {
    startTransition(async () => {
      try {
        await setClubStatus(clubId, next);
        toast.success(
          next === "active"
            ? "باشگاه فعال شد."
            : next === "suspended"
              ? "باشگاه معلق شد."
              : "باشگاه به حالت در انتظار تایید بازگشت."
        );
        router.refresh();
      } catch (error) {
        toast.error(getErrorMessage(error, "خطا در تغییر وضعیت باشگاه."));
      }
    });
  }

  if (status === "pending") {
    return (
      <div className="flex items-center gap-2">
        <Button onClick={() => setStatus("active")} disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" />}
          تایید و فعال‌سازی باشگاه
        </Button>
        <Button
          variant="destructive"
          onClick={() => setStatus("suspended")}
          disabled={isPending}
        >
          رد درخواست باشگاه
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant={status === "active" ? "destructive" : "default"}
      onClick={() => setStatus(status === "active" ? "suspended" : "active")}
      disabled={isPending}
    >
      {isPending && <Loader2 className="animate-spin" />}
      {status === "active" ? "معلق‌سازی باشگاه" : "فعال‌سازی مجدد باشگاه"}
    </Button>
  );
}
