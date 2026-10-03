import { CalendarClock, TriangleAlert } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPersianDate, toPersianDigits } from "@/lib/persian";
import { SectionHeader } from "./section-header";
import { EmptyState } from "./empty-state";
import type { FreeClubPlan, SubscriptionInfo } from "../../types/dashboard-types";

const STATUS_LABEL: Record<SubscriptionInfo["status"], string> = {
  active: "فعال",
  expiring: "در حال اتمام",
  grace: "در مهلت",
  expired: "منقضی شده",
};

const STATUS_VARIANT: Record<SubscriptionInfo["status"], "success" | "warning" | "destructive"> = {
  active: "success",
  expiring: "warning",
  grace: "warning",
  expired: "destructive",
};

export function SubscriptionCard({
  subscription,
  freePlan = null,
}: {
  subscription: SubscriptionInfo | null;
  /** The free club plan, when the club is on it (no paid plan running). */
  freePlan?: FreeClubPlan | null;
}) {
  if (freePlan) return <FreePlanCard plan={freePlan} ended={subscription} />;
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
                  ? "اشتراک باشگاه منقضی شده است. برای دعوت عضو یا مربی تازه، تمدید کنید."
                  : subscription.status === "grace"
                    ? "اشتراک باشگاه تمام شده؛ در مهلت چندروزه همه‌چیز عادی است، ولی بعد از آن فقط ظرفیت پلن رایگان می‌ماند. تمدید کنید."
                    : "اشتراک باشگاه به‌زودی منقضی می‌شود."}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

const capText = (n: number | null, unit: string) => (n === null ? `${unit} نامحدود` : `تا ${toPersianDigits(n)} ${unit}`);

/** A club on the free club plan: its caps, and the paid plan that ended, if any. */
function FreePlanCard({ plan, ended }: { plan: FreeClubPlan; ended: SubscriptionInfo | null }) {
  return (
    <Card className="py-5">
      <SectionHeader title="وضعیت اشتراک" action={<Badge variant="secondary">{plan.name}</Badge>} />
      <div className="space-y-3 px-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">پلن فعلی</span>
          <span className="font-medium text-foreground">{plan.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">ظرفیت</span>
          <span className="font-medium text-foreground">
            {capText(plan.maxMembers, "عضو")} و {capText(plan.maxTrainers, "مربی")}
          </span>
        </div>
        {ended && (
          <p className="text-xs text-muted-foreground">
            اشتراک «{ended.planName}» در {formatPersianDate(new Date(ended.expiresAt))} تمام شد. اعضا و مربی‌های فعلی
            می‌مانند.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          برای عضو یا مربی بیشتر، از «امور مالی ← اشتراک پلتفرم» پلن تهیه کنید.
        </p>
      </div>
    </Card>
  );
}
