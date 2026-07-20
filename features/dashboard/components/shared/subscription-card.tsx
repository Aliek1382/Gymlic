import { CalendarClock, TriangleAlert } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPersianDate, toPersianDigits } from "@/lib/persian";
import { SectionHeader } from "./section-header";
import { EmptyState } from "./empty-state";
import type { SubscriptionInfo } from "../../types/dashboard-types";

const STATUS_LABEL: Record<SubscriptionInfo["status"], string> = {
  active: "فعال",
  expiring: "در حال اتمام",
  expired: "منقضی شده",
};

const STATUS_VARIANT: Record<SubscriptionInfo["status"], "success" | "warning" | "destructive"> = {
  active: "success",
  expiring: "warning",
  expired: "destructive",
};

export function SubscriptionCard({
  subscription,
}: {
  subscription: SubscriptionInfo | null;
}) {
  return (
    <Card className="py-5">
      <SectionHeader
        title="وضعیت اشتراک"
        action={
          subscription && (
            <Badge variant={STATUS_VARIANT[subscription.status]}>
              {STATUS_LABEL[subscription.status]}
            </Badge>
          )
        }
      />
      <div className="px-6">
        {!subscription ? (
          <EmptyState
            icon={CalendarClock}
            title="اشتراکی برای این باشگاه ثبت نشده است."
          />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">پلن فعلی</span>
              <span className="font-medium text-foreground">
                {subscription.planName}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">تاریخ پایان</span>
              <span className="font-medium text-foreground">
                {formatPersianDate(new Date(subscription.expiresAt))}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                روزهای باقی‌مانده
              </span>
              <span className="font-medium text-foreground">
                {toPersianDigits(subscription.remainingDays)} روز
              </span>
            </div>

            {subscription.status !== "active" && (
              <div className="flex items-center gap-2 rounded-xl bg-warning-muted px-3 py-2 text-xs text-warning">
                <TriangleAlert className="size-4 shrink-0" />
                {subscription.status === "expired"
                  ? "اشتراک باشگاه منقضی شده است. برای ادامه استفاده تمدید کنید."
                  : "اشتراک باشگاه به‌زودی منقضی می‌شود."}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
