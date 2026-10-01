"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/get-error-message";
import { useAdminCan } from "../hooks/use-admin-access";
import { setProfileSuspended } from "../services/admin-service";

export function SuspendToggle({
  userId,
  isSuspended,
}: {
  userId: string;
  isSuspended: boolean;
}) {
  const can = useAdminCan();
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


  // A role that can only view users sees the state, not the switch.
  if (!can("users.manage")) return null;
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
