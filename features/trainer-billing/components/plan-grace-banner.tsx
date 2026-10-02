import Link from "next/link";
import { CalendarClock, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TrainerDataExportButton } from "@/features/settings/components/trainer-data-export";
import { formatNumber, formatPersianDate } from "@/lib/persian";
import type { TrainerLimits } from "../services/trainer-billing-service";

const parseDate = (value: string) => new Date(value.replace(" ", "T"));

/** Whole days until $value, rounded up; 0 once it is past. */
function daysUntil(value: string): number {
  return Math.max(0, Math.ceil((parseDate(value).getTime() - Date.now()) / 86_400_000));
}

/**
 * Where the trainer's paid plan stands when it needs their attention: about
 * to end, ended but still in its grace days (everything works, the limits
 * of the free plan come after), or ended with athletes put on hold. Nothing
 * on the free plan or a plan that is simply running.
 */
export function PlanGraceBanner({
  limits,
  showChooseLink = true,
}: {
  limits: TrainerLimits | undefined;
  showChooseLink?: boolean;
}) {
  if (!limits?.ready || !limits.subscription || limits.subscription.is_free) return null;
  const { subscription, status } = limits;

  if (status === "grace" && limits.enforcing && subscription.grace_ends_at) {
    const left = daysUntil(subscription.grace_ends_at);
    return (
      <Banner
        tone="warning"
        title="اشتراک شما تمام شده است"
        text={
          <>
            اشتراک «{subscription.plan_name}» در{" "}
            {subscription.expires_at ? formatPersianDate(parseDate(subscription.expires_at)) : "—"} تمام شد. تا{" "}
            {formatNumber(left)} روز دیگر ({formatPersianDate(parseDate(subscription.grace_ends_at))}) همه‌چیز مثل قبل
            است؛ بعد از آن محدودیت‌های پلن رایگان اعمال می‌شود
            {limits.suspend_after_grace > 0
              ? ` و ${formatNumber(limits.suspend_after_grace)} ورزشکار غیرفعال می‌شوند (حذف نمی‌شوند).`
              : "."}
          </>
        }
        chooseLink={showChooseLink && limits.suspend_after_grace > 0}
        exportLink
      />
    );
  }

  if (status === "expiring" && subscription.remaining_days != null) {
    return (
      <Banner
        tone="info"
        title="اشتراک شما رو به پایان است"
        text={`اشتراک «${subscription.plan_name}» تا ${formatNumber(subscription.remaining_days)} روز دیگر فعال است. برای ادامه بدون وقفه، تمدید کنید.`}
        chooseLink={false}
      />
    );
  }

  if (status === "expired" && limits.usage.suspended > 0) {
    return (
      <Banner
        tone="warning"
        title="برخی ورزشکاران غیرفعال هستند"
        text={`اشتراک شما و مهلت پس از آن تمام شده و پلن رایگان تا ${formatNumber(limits.free_max_athletes ?? 0)} ورزشکار فعال دارد؛ ${formatNumber(limits.usage.suspended)} ورزشکار غیرفعال شده‌اند. برنامه‌هایشان فقط‌خواندنی است. با تمدید، همه فوراً برمی‌گردند.`}
        chooseLink={showChooseLink}
        exportLink
      />
    );
  }

  return null;
}

function Banner({
  tone,
  title,
  text,
  chooseLink,
  exportLink = false,
}: {
  tone: "warning" | "info";
  title: string;
  text: React.ReactNode;
  chooseLink: boolean;
  /** After a paid plan ends: the trainer's data stays theirs to take, on any plan. */
  exportLink?: boolean;
}) {
  const Icon = tone === "warning" ? TriangleAlert : CalendarClock;
  return (
    <div
      className={
        tone === "warning"
          ? "flex flex-col gap-3 rounded-2xl border border-warning/30 bg-warning-muted p-4 sm:flex-row sm:items-center sm:justify-between"
          : "flex flex-col gap-3 rounded-2xl border border-info/30 bg-info-muted p-4 sm:flex-row sm:items-center sm:justify-between"
      }
    >
      <div className="flex gap-3">
        <Icon className={tone === "warning" ? "mt-0.5 size-5 shrink-0 text-warning" : "mt-0.5 size-5 shrink-0 text-info"} />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{text}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {chooseLink && (
          <Button size="sm" variant="outline" asChild>
            <Link href="/subscription/athletes">انتخاب ورزشکاران فعال</Link>
          </Button>
        )}
        {exportLink && <TrainerDataExportButton size="sm" variant="ghost" label="اطلاعات خود را دریافت کنید" />}
        <Button size="sm" asChild>
          <Link href="/subscription">تمدید اشتراک</Link>
        </Button>
      </div>
    </div>
  );
}
