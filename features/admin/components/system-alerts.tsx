"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Clock, DatabaseZap, Inbox } from "lucide-react";

import { formatNumber } from "@/lib/persian";
import { getSystemAlerts } from "../services/admin-system-service";

/**
 * The overview's "needs attention" strip — the admin's version of
 * WordPress's "updates available". Renders nothing when all is well, or when
 * the request fails (an older backend without the endpoint).
 */
export function SystemAlerts() {
  const { data } = useQuery({
    queryKey: ["admin", "system", "alerts"],
    queryFn: getSystemAlerts,
    retry: false,
  });
  if (!data) return null;

  const alerts: { icon: typeof Clock; text: string; href: string; tone: string }[] = [];
  if (data.pending_migrations > 0) {
    alerts.push({
      icon: DatabaseZap,
      text: `${formatNumber(data.pending_migrations)} به‌روزرسانی دیتابیس در انتظار اجراست.`,
      href: "/admin/database",
      tone: "border-warning/30 bg-warning-muted text-warning",
    });
  }
  const stalled = data.cron_problems.filter((cron) => cron.state === "stalled");
  if (stalled.length > 0) {
    alerts.push({
      icon: Clock,
      text: `کران‌جاب متوقف شده: ${stalled.map((cron) => cron.label).join("، ")}.`,
      href: "/admin/system",
      tone: "border-destructive/30 bg-destructive/10 text-destructive",
    });
  }
  if (data.failed_deliveries > 0) {
    alerts.push({
      icon: Inbox,
      text: `${formatNumber(data.failed_deliveries)} پیامک یا ایمیل در ۳۰ روز گذشته ارسال نشده است.`,
      href: "/admin/deliveries",
      tone: "border-warning/30 bg-warning-muted text-warning",
    });
  }
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map(({ icon: Icon, text, href, tone }) => (
        <Link
          key={href}
          href={href}
          className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition-opacity hover:opacity-90 ${tone}`}
        >
          <Icon className="size-5 shrink-0" />
          <span className="flex-1">{text}</span>
          <ChevronLeft className="size-4 shrink-0" />
        </Link>
      ))}
    </div>
  );
}
