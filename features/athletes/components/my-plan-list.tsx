"use client";

import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPersianDate } from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { useMyPlans } from "../hooks/use-my-plans";
import type { PlanKind } from "../types/athlete-types";

export function MyPlanList({
  kind,
  icon,
  emptyTitle,
  emptyDescription,
}: {
  kind: PlanKind;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const plans = useMyPlans(kind);

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
          icon={icon}
          title={emptyTitle}
          description={emptyDescription}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {plans.data.map((plan) => (
        <Card key={plan.id} className="gap-2 py-5">
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
