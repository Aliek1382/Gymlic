"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Crown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/persian";
import { SubscriptionStatusBadge } from "@/features/admin/components/subscription-status-badge";
import { getTrainerBilling } from "../services/trainer-billing-service";
import { PlanGraceBanner } from "./plan-grace-banner";

/**
 * The trainer's plan on their dashboard: which plan, how many of its
 * athletes are used ("۲ از ۳ ورزشکار"), and the grace banner when the paid
 * plan has ended. Shares its query with the "my subscription" page.
 */
export function TrainerPlanCard() {
  const { data } = useQuery({ queryKey: ["trainer-billing"], queryFn: getTrainerBilling });
  const limits = data?.limits;
  if (!limits?.ready) return null;

  const used = limits.usage.active + limits.usage.pending_invites;
  const full = limits.max_athletes != null && used >= limits.max_athletes;

  return (
    <div className="space-y-3">
      <PlanGraceBanner limits={limits} />
      <Card className="gap-3 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2 px-6">
          <CardTitle className="flex items-center gap-2 text-base">
            <Crown className="size-4" />
            پلن {limits.plan.name ?? "—"}
          </CardTitle>
          <div className="flex items-center gap-2">
            {limits.override && <Badge variant="info">سقف ویژه</Badge>}
            {limits.plan.is_free ? <Badge variant="secondary">رایگان</Badge> : <SubscriptionStatusBadge status={limits.status} />}
          </div>
        </div>
        <div className="flex flex-col gap-3 px-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 text-sm">
            <p className="text-foreground">
              <span className="text-lg font-bold">{formatNumber(used)}</span>
              {limits.max_athletes != null ? ` از ${formatNumber(limits.max_athletes)} ورزشکار` : " ورزشکار (بدون سقف)"}
            </p>
            {limits.usage.pending_invites > 0 && (
              <p className="text-xs text-muted-foreground">
                شامل {formatNumber(limits.usage.pending_invites)} دعوت در انتظار
              </p>
            )}
            {limits.usage.suspended > 0 && (
              <p className="text-xs text-warning">{formatNumber(limits.usage.suspended)} ورزشکار غیرفعال به‌خاطر پلن</p>
            )}
            {limits.club && (
              <p className="text-xs text-muted-foreground">
                ورزشکارانی که از طرف باشگاه «{limits.club.name}» دعوت می‌کنید، تابع پلن باشگاه هستند.
              </p>
            )}
          </div>
          <Button size="sm" variant={full ? "default" : "outline"} asChild>
            <Link href="/subscription">{limits.plan.is_free || full ? "ارتقای پلن" : "اشتراک من"}</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
