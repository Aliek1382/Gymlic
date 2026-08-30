"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/get-error-message";
import { updatePlan } from "../services/admin-service";

export function PlanActiveToggle({
  planId,
  isActive,
}: {
  planId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle(next: boolean) {
    startTransition(async () => {
      try {
        await updatePlan(planId, { isActive: next });
        toast.success(next ? "پلن فعال شد." : "پلن غیرفعال شد.");
        router.refresh();
      } catch (error) {
        toast.error(getErrorMessage(error, "خطا در تغییر وضعیت پلن."));
      }
    });
  }

  return <Switch checked={isActive} onCheckedChange={toggle} disabled={isPending} />;
}
