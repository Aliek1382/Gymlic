import type { LucideIcon } from "lucide-react";

import { Card, CardTitle } from "@/components/ui/card";
import { formatPersianDate } from "@/lib/persian";
import { EmptyState } from "../shared/empty-state";
import type { AthletePlanSummary } from "../../types/dashboard-types";

export function PlanSummaryCard({
  title,
  icon: Icon,
  plan,
  emptyTitle,
  emptyDescription,
}: {
  title: string;
  icon: LucideIcon;
  plan: AthletePlanSummary | null;
  emptyTitle: string;
  emptyDescription: string;
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
            {plan.description && (
              <p className="whitespace-pre-line rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
                {plan.description}
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
