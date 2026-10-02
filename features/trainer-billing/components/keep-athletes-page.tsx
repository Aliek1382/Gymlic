"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { RoleGate } from "@/features/authentication/components/role-gate";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber, formatRelativeTime } from "@/lib/persian";
import { getKeepList, saveKeepList } from "../services/trainer-billing-service";
import { PlanGraceBanner } from "./plan-grace-banner";

const QUERY_KEY = ["trainer-billing", "keep-list"] as const;

/**
 * Which athletes stay active once the trainer is on the free plan. Picked
 * ahead of time while a paid plan runs, or at any time after it ended; the
 * ones not picked are put on hold (never removed), the most recently seen
 * first to stay when fewer are picked than the free plan allows.
 */
export function KeepAthletesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: QUERY_KEY, queryFn: getKeepList });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.items) {
      setSelected(new Set(data.items.filter((a) => a.keep_on_downgrade).map((a) => a.id)));
    }
  }, [data]);

  const cap = data?.limits?.free_max_athletes ?? null;
  const onFree = data?.limits?.status === "expired" || data?.limits?.plan.is_free;
  const items = useMemo(() => data?.items ?? [], [data]);

  function toggle(id: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (on) {
        if (cap != null && next.size >= cap) {
          toast.error(`در پلن رایگان حداکثر ${formatNumber(cap)} ورزشکار فعال می‌ماند.`);
          return current;
        }
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await saveKeepList([...selected]);
      toast.success(onFree ? "ورزشکاران فعال به‌روز شدند." : "انتخاب شما ذخیره شد و هنگام پایان اشتراک اعمال می‌شود.");
      void queryClient.invalidateQueries({ queryKey: ["trainer-billing"] });
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیرهٔ انتخاب ناموفق بود."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <RoleGate allow={["trainer"]}>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">ورزشکاران فعال در پلن رایگان</h1>
            <p className="text-sm text-muted-foreground">
              پس از پایان اشتراک و مهلت آن، پلن رایگان
              {cap != null ? ` تا ${formatNumber(cap)} ورزشکار ` : " "}
              فعال دارد. انتخاب کنید کدام‌ها فعال بمانند؛ بقیه حذف نمی‌شوند، فقط تا تمدید غیرفعال‌اند
              (برنامهٔ آخرشان فقط‌خواندنی است و پیام و برنامهٔ تازه نمی‌گیرند). اگر کسی را انتخاب نکنید،
              ورزشکارانی که اخیراً فعال‌تر بوده‌اند می‌مانند.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/subscription">
              <ArrowRight />
              اشتراک من
            </Link>
          </Button>
        </div>

        <PlanGraceBanner limits={data?.limits} showChooseLink={false} />

        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : isError || !data ? (
          <ErrorState message="دریافت فهرست ورزشکاران با خطا مواجه شد." />
        ) : !data.ready ? (
          <Card className="py-5">
            <p className="px-6 text-sm text-muted-foreground">این بخش هنوز فعال نشده است.</p>
          </Card>
        ) : (
          <Card className="gap-4 py-5">
            <div className="flex flex-wrap items-center justify-between gap-2 px-6">
              <div className="space-y-1">
                <CardTitle className="text-base">
                  {formatNumber(selected.size)}
                  {cap != null ? ` از ${formatNumber(cap)}` : ""} انتخاب‌شده
                </CardTitle>
                <CardDescription>
                  فقط ورزشکارانی که خودتان (نه از طرف باشگاه) دعوت کرده‌اید در این فهرست هستند.
                </CardDescription>
              </div>
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                ذخیرهٔ انتخاب
              </Button>
            </div>
            {items.length === 0 ? (
              <div className="px-6">
                <EmptyState icon={Users} title="ورزشکاری ندارید." />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((athlete) => (
                  <li key={athlete.id} className="flex items-center justify-between gap-3 px-6 py-3">
                    <label htmlFor={`keep-${athlete.id}`} className="flex min-w-0 cursor-pointer flex-col">
                      <span className="truncate font-medium text-foreground">
                        {[athlete.first_name, athlete.last_name].filter(Boolean).join(" ") || "ورزشکار"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {athlete.last_seen_at
                          ? `آخرین فعالیت: ${formatRelativeTime(new Date(athlete.last_seen_at.replace(" ", "T")))}`
                          : "هنوز وارد نشده"}
                      </span>
                    </label>
                    <div className="flex shrink-0 items-center gap-3">
                      {athlete.suspended_by_plan && <Badge variant="warning">غیرفعال</Badge>}
                      <Switch
                        id={`keep-${athlete.id}`}
                        checked={selected.has(athlete.id)}
                        onCheckedChange={(on) => toggle(athlete.id, on)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </RoleGate>
  );
}
