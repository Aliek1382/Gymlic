"use client";

import { Apple, Dumbbell } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPersianDate } from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { useMyPlans } from "../hooks/use-my-plans";
import type { PlanKind } from "../types/athlete-types";

// Icon components can't cross the Server -> Client Component boundary as a
// prop (only serializable values can), so it's picked here from `kind`
// rather than being passed in from the (server) page.
const ICON_BY_KIND = { workout: Dumbbell, nutrition: Apple } as const;

export function MyPlanList({
  kind,
  emptyTitle,
  emptyDescription,
}: {
  kind: PlanKind;
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
          icon={ICON_BY_KIND[kind]}
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
