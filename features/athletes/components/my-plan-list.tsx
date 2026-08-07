"use client";

import { Apple, CheckCircle2, Download, Dumbbell } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPersianDate } from "@/lib/persian";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { useCompletePlan } from "../hooks/use-complete-plan";
import { useMyPlans } from "../hooks/use-my-plans";
import { usePlanPrint } from "../hooks/use-plan-print";
import { PlanPrintArea } from "./plan-print-area";
import type { PlanKind } from "../types/athlete-types";

// Icon components can't cross the Server -> Client Component boundary as a
// prop (only serializable values can), so it's picked here from `kind`
// rather than being passed in from the (server) page.
const ICON_BY_KIND = { workout: Dumbbell, nutrition: Apple } as const;

export function MyPlanList({
  kind,
  emptyTitle,
  emptyDescription,
  trainerName,
}: {
  kind: PlanKind;
  emptyTitle: string;
  emptyDescription: string;
  trainerName?: string | null;
}) {
  const plans = useMyPlans(kind);
  const completePlan = useCompletePlan(kind);
  const { plan: printingPlan, printPlan } = usePlanPrint();

  async function handleComplete(planId: string) {
    try {
      await completePlan.mutateAsync(planId);
      toast.success("این برنامه به‌عنوان تکمیل‌شده علامت خورد.");
    } catch (error) {
      toast.error(getErrorMessage(error, "ثبت تکمیل برنامه با خطا مواجه شد."));
    }
  }

  if (plans.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!plans.data || plans.data.length === 0) {
    return (
      <Card className="py-5">
        <EmptyState
          icon={ICON_BY_KIND[kind]}
          title={emptyTitle}
          description={emptyDescription}
        />
      </Card>
    );
  }

  // The most recently assigned plan that's actually in effect (not a draft,
  // not already completed/cancelled) — this is "what the athlete should be
  // doing right now," and shifts automatically the moment a newer active
  // plan is saved, since it's derived from assignedAt rather than tracked
  // as separate state.
  const latestPlanId = plans.data.find((plan) => plan.status === "active")?.id;

  return (
    <div className="space-y-3">
      {plans.data.map((plan) => (
        <Card
          key={plan.id}
          className={cn(
            "gap-2 py-5",
            plan.id === latestPlanId && "border-primary ring-1 ring-primary/30"
          )}
        >
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-medium text-foreground">{plan.title}</p>
              <p className="text-xs text-muted-foreground">
                {formatPersianDate(new Date(plan.assignedAt))}
              </p>
            </div>
            {plan.description && (
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {plan.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {plan.id === latestPlanId && (
                <Badge variant="info">آخرین برنامه</Badge>
              )}
              {plan.status === "completed" && (
                <Badge variant="success">تکمیل‌شده</Badge>
              )}
              {plan.status === "active" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={completePlan.isPending}
                  onClick={() => handleComplete(plan.id)}
                >
                  <CheckCircle2 />
                  این برنامه را انجام دادم
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  printPlan({
                    kind,
                    title: plan.title,
                    description: plan.description,
                    assignedAt: plan.assignedAt,
                    trainerName: trainerName ?? undefined,
                  })
                }
              >
                <Download />
                دانلود PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <PlanPrintArea plan={printingPlan} />
    </div>
  );
}
