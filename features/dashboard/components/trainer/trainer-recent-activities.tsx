import { Apple, Dumbbell, ListChecks } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { formatPersianDate } from "@/lib/persian";
import { EmptyState } from "../shared/empty-state";
import { ACTIVITY_STATUS_LABEL } from "../../constants/dashboard";
import type { TrainerActivityItem } from "../../types/dashboard-types";

export function TrainerRecentActivities({
  activities,
}: {
  activities: TrainerActivityItem[];
}) {
  return (
    <Card className="gap-4 py-5">
      <div className="px-6">
        <CardTitle className="text-base">آخرین فعالیت‌ها</CardTitle>
      </div>

      {activities.length === 0 ? (
        <div className="px-6">
          <EmptyState
            icon={ListChecks}
            title="هنوز فعالیتی ثبت نشده است."
            description="با ساخت اولین برنامه تمرینی یا غذایی، فعالیت‌ها اینجا نمایش داده می‌شوند."
          />
        </div>
      ) : (
        <div className="space-y-1 px-3">
          {activities.map((activity) => {
            const Icon = activity.type === "workout" ? Dumbbell : Apple;
            return (
              <div
                key={activity.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {activity.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {activity.athleteName}
                  </p>
                </div>
                <Badge variant={activity.status === "cancelled" ? "secondary" : "success"}>
                  {ACTIVITY_STATUS_LABEL[activity.status]}
                </Badge>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                  {formatPersianDate(new Date(activity.date))}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
