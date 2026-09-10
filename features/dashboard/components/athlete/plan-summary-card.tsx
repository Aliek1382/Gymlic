import type { LucideIcon } from "lucide-react";

import { Card, CardTitle } from "@/components/ui/card";
import { formatPersianDate } from "@/lib/persian";
import { PlanSections } from "@/features/athletes";
import type { PlanKind } from "@/features/athletes";
import { EmptyState } from "../shared/empty-state";
import type { AthletePlanSummary } from "../../types/dashboard-types";

export function PlanSummaryCard({
  title,
  icon: Icon,
  plan,
  emptyTitle,
  emptyDescription,
  // Picks which layout the description is parsed into — day cards for a
  // workout plan, meal blocks for a nutrition one. Day ticking rides on the
  // workout kind alone; workout_day_logs has no equivalent for
  // nutrition_assignments.
  planKind,
}: {
  title: string;
  icon: LucideIcon;
  plan: AthletePlanSummary | null;
  emptyTitle: string;
  emptyDescription: string;
  planKind: PlanKind;
}) {
  return (
    <Card className="gap-4 py-5">
      <div className="px-6">
        <CardTitle className="text-base">{title}</CardTitle>
      </div>
      <div className="px-6">
        {!plan ? (
          <EmptyState icon={Icon} title={emptyTitle} description={emptyDescription} />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="size-6" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{plan.title}</p>
                <p className="text-xs text-muted-foreground">
                  تخصیص داده شده در {formatPersianDate(new Date(plan.assignedAt))}
                </p>
              </div>
            </div>
            <PlanSections
              planId={plan.id}
              description={plan.description}
              kind={planKind}
              isActivePlan
              dayLogging={planKind === "workout"}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
