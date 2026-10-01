"use client";

import { useState } from "react";
import { Pill, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { getErrorMessage } from "@/lib/get-error-message";
import { PLAN_STATUS_LABEL, PLAN_STATUS_VARIANT } from "../constants";
import { useSupplementPlans } from "../hooks/use-supplement-plans";
import {
  useDeleteSupplementPlan,
  useUpdateSupplementPlan,
} from "../hooks/use-supplement-plan-actions";
import type { SupplementPlan } from "../types/supplement-types";
import { SupplementPlanDialog } from "./supplement-plan-dialog";
import { SupplementPlanItems } from "./supplement-plan-items";

function PlanCard({ plan }: { plan: SupplementPlan }) {
  const updatePlan = useUpdateSupplementPlan();
  const deletePlan = useDeleteSupplementPlan();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function setStatus(status: "active" | "completed") {
    try {
      await updatePlan.mutateAsync({ id: plan.id, status });
    } catch (error) {
      toast.error(getErrorMessage(error, "تغییر وضعیت برنامه با خطا مواجه شد."));
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="font-medium text-foreground">{plan.title}</p>
          <Badge variant={PLAN_STATUS_VARIANT[plan.status]}>{PLAN_STATUS_LABEL[plan.status]}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SupplementPlanDialog athleteId={plan.athleteId} plan={plan} />
          {plan.status === "active" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={updatePlan.isPending}
              onClick={() => setStatus("completed")}
            >
              پایان دوره
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={updatePlan.isPending}
              onClick={() => setStatus("active")}
            >
              فعال‌سازی مجدد
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            aria-label="حذف برنامه"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <SupplementPlanItems plan={plan} />

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="حذف برنامه مکمل"
        description={`برنامه «${plan.title}» برای همیشه حذف می‌شود و ورزشکار دیگر یادآوری آن را دریافت نمی‌کند.`}
        confirmLabel="حذف برنامه"
        errorMessage="حذف برنامه با خطا مواجه شد."
        onConfirm={() => deletePlan.mutateAsync(plan.id)}
      />
    </div>
  );
}

/**
 * An athlete's supplement plans, for their trainer. `embedded` drops the card
 * chrome so it can sit inside another dialog (the nutrition plan one).
 */
export function SupplementPlansPanel({
  athleteId,
  embedded = false,
}: {
  athleteId: string;
  embedded?: boolean;
}) {
  const plans = useSupplementPlans(athleteId);
  const Wrapper = embedded ? "div" : Card;
  const gutter = embedded ? "" : "px-6";

  return (
    <Wrapper className={embedded ? "space-y-4" : "gap-4 py-5"}>
      <div className={`flex flex-wrap items-center justify-between gap-3 ${gutter}`}>
        <div>
          <h2 className="text-base font-bold text-foreground">برنامه مکمل</h2>
          <p className="text-xs text-muted-foreground">
            مکمل، دوز و زمان مصرف را مشخص کنید؛ سر زمان مصرف برای ورزشکار اعلان ارسال می‌شود.
          </p>
        </div>
        <SupplementPlanDialog athleteId={athleteId} />
      </div>

      <div className={`space-y-3 ${gutter}`}>
        {plans.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : plans.isError ? (
          <p className="text-sm text-destructive">دریافت برنامه‌های مکمل با خطا مواجه شد.</p>
        ) : !plans.data || plans.data.length === 0 ? (
          <EmptyState
            icon={Pill}
            title="هنوز برنامه مکملی ثبت نشده است."
            description="با دکمه «برنامه مکمل جدید» اولین برنامه را بسازید."
          />
        ) : (
          plans.data.map((plan) => <PlanCard key={plan.id} plan={plan} />)
        )}
      </div>
    </Wrapper>
  );
}
