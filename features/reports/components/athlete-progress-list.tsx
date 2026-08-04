"use client";

import { useState } from "react";
import { Apple, ChevronLeft, Dumbbell, Users } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPersianDate, toPersianDigits } from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { useAthleteProgress } from "../hooks/use-athlete-progress";
import { useCompletedPlans } from "../hooks/use-completed-plans";

const KIND_ICON = { workout: Dumbbell, nutrition: Apple } as const;
const KIND_LABEL = { workout: "تمرینی", nutrition: "غذایی" } as const;

export function AthleteProgressList() {
  const progress = useAthleteProgress();
  const [selectedAthlete, setSelectedAthlete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const completedPlans = useCompletedPlans(
    selectedAthlete?.id ?? "",
    !!selectedAthlete
  );

  if (progress.isLoading) {
    return (
      <Card className="gap-4 py-5">
        <div className="space-y-2 px-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </Card>
    );
  }

  if (progress.isError) {
    return (
      <Card className="border-destructive/30 py-5">
        <p className="px-6 text-sm text-destructive">
          دریافت گزارش پیشرفت ورزشکاران با خطا مواجه شد.
        </p>
      </Card>
    );
  }

  if (!progress.data || progress.data.length === 0) {
    return (
      <Card className="py-5">
        <EmptyState
          icon={Users}
          title="هنوز ورزشکاری ثبت نشده است."
          description="بعد از افزودن ورزشکار و تکمیل برنامه‌ها، پیشرفت آن‌ها اینجا نمایش داده می‌شود."
        />
      </Card>
    );
  }

  return (
    <>
      <Card className="gap-4 py-5">
        <div className="px-6">
          <CardTitle className="text-base">پیشرفت ورزشکاران</CardTitle>
        </div>
        <div className="space-y-2 px-6">
          {progress.data.map((athlete) => (
            <button
              key={athlete.athleteId}
              type="button"
              onClick={() =>
                setSelectedAthlete({ id: athlete.athleteId, name: athlete.name })
              }
              className="flex w-full items-center gap-3 rounded-xl border border-border p-4 text-right transition-colors hover:bg-muted/50"
            >
              <Avatar className="size-9 shrink-0">
                <AvatarFallback className="text-xs">
                  {athlete.name.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {athlete.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {toPersianDigits(athlete.completedCount)} برنامه تکمیل‌شده
                </p>
              </div>
              <ChevronLeft className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </Card>

      <Dialog
        open={!!selectedAthlete}
        onOpenChange={(open) => !open && setSelectedAthlete(null)}
      >
        {selectedAthlete && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                برنامه‌های تکمیل‌شده {selectedAthlete.name}
              </DialogTitle>
              <DialogDescription>
                لیست برنامه‌هایی که این ورزشکار تکمیل کرده است.
              </DialogDescription>
            </DialogHeader>

            {completedPlans.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : !completedPlans.data || completedPlans.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                هنوز برنامه‌ی تکمیل‌شده‌ای برای این ورزشکار ثبت نشده است.
              </p>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {completedPlans.data.map((plan) => {
                  const Icon = KIND_ICON[plan.kind];
                  return (
                    <div
                      key={`${plan.kind}-${plan.id}`}
                      className="flex items-center gap-3 rounded-xl border border-border p-3"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-success-muted text-success">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {plan.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatPersianDate(new Date(plan.assignedAt))}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {KIND_LABEL[plan.kind]}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
