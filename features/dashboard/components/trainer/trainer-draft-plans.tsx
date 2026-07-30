import Link from "next/link";
import { Apple, Dumbbell, FileEdit } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { formatPersianDate } from "@/lib/persian";
import { EmptyState } from "../shared/empty-state";
import type { TrainerDraftPlan } from "../../types/dashboard-types";

export function TrainerDraftPlans({
  drafts,
}: {
  drafts: TrainerDraftPlan[];
}) {
  return (
    <Card className="gap-4 py-5">
      <div className="px-6">
        <CardTitle className="text-base">پیش‌نویس‌های ناتمام</CardTitle>
      </div>

      {drafts.length === 0 ? (
        <div className="px-6">
          <EmptyState
            icon={FileEdit}
            title="پیش‌نویس ناتمامی ندارید."
            description="اگر نوشتن یک برنامه را نیمه‌کاره رها کنید، اینجا نمایش داده می‌شود."
          />
        </div>
      ) : (
        <div className="space-y-1 px-3">
          {drafts.map((draft) => {
            const Icon = draft.type === "workout" ? Dumbbell : Apple;
            const href =
              draft.type === "workout" ? "/workout-programs" : "/nutrition-programs";
            return (
              <Link
                key={draft.id}
                href={href}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {draft.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {draft.athleteName}
                    {draft.description ? ` · ${draft.description}` : ""}
                  </p>
                </div>
                <Badge variant="warning">پیش‌نویس</Badge>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                  {formatPersianDate(new Date(draft.updatedAt))}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}
