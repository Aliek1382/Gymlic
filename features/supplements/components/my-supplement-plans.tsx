"use client";

import { Pill } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { PLAN_STATUS_LABEL, PLAN_STATUS_VARIANT } from "../constants";
import { useMySupplementPlans } from "../hooks/use-my-supplement-plans";
import { SupplementPlanItems } from "./supplement-plan-items";

/** The athlete's own supplement plans — shown under their nutrition plans so the diet lives in one place. */
export function MySupplementPlans() {
  const plans = useMySupplementPlans();

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-foreground">برنامه مکمل</h2>
        <p className="text-sm text-muted-foreground">
          مکمل‌هایی که مربی برای شما تعیین کرده است. سر زمان مصرف در اعلان‌ها یادآوری می‌شود.
        </p>
      </div>

      {plans.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : plans.isError ? (
        <Card className="border-destructive/30 py-5">
          <p className="px-6 text-sm text-destructive">دریافت برنامه مکمل با خطا مواجه شد.</p>
        </Card>
      ) : !plans.data || plans.data.length === 0 ? (
        <Card className="py-5">
          <EmptyState
            icon={Pill}
            title="هنوز برنامه مکملی ندارید."
            description="به محض ثبت برنامه مکمل توسط مربی، اینجا نمایش داده می‌شود."
          />
        </Card>
      ) : (
        plans.data.map((plan) => (
          <Card key={plan.id} className="gap-4 py-5">
            <div className="flex flex-wrap items-center justify-between gap-2 px-6">
              <div>
                <p className="font-medium text-foreground">{plan.title}</p>
                <p className="text-xs text-muted-foreground">مربی: {plan.trainerName}</p>
              </div>
              <Badge variant={PLAN_STATUS_VARIANT[plan.status]}>{PLAN_STATUS_LABEL[plan.status]}</Badge>
            </div>
            <div className="px-6">
              <SupplementPlanItems plan={plan} />
            </div>
          </Card>
        ))
      )}
    </section>
  );
}
