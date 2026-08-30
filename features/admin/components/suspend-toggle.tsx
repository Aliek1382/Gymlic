"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/get-error-message";
import { setProfileSuspended } from "../services/admin-service";

export function SuspendToggle({
  userId,
  isSuspended,
}: {
  userId: string;
  isSuspended: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      try {
        await setProfileSuspended(userId, !isSuspended);
        toast.success(isSuspended ? "حساب فعال شد." : "حساب مسدود شد.");
        router.refresh();
      } catch (error) {
        toast.error(getErrorMessage(error, "خطا در تغییر وضعیت حساب."));
      }
    });
  }

  return (
    <Button
      variant={isSuspended ? "default" : "destructive"}
      onClick={toggle}
      disabled={isPending}
    >
      {isPending && <Loader2 className="animate-spin" />}
      {isSuspended ? "فعال‌سازی حساب" : "مسدودسازی حساب"}
    </Button>
  );
}
