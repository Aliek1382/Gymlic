"use client";

import { useMemo, useState } from "react";
import { Apple, ChevronLeft, Dumbbell, Search, Users } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPersianDate } from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { TableCardSkeleton } from "@/features/dashboard/components/shared/dashboard-skeleton";
import { useAthletes } from "../hooks/use-athletes";
import { usePlans } from "../hooks/use-plans";
import type { PlanEntry } from "../services/athlete-service";
import type { PlanKind } from "../types/athlete-types";

type SortOrder = "newest" | "oldest";

const ICON_BY_KIND = { workout: Dumbbell, nutrition: Apple } as const;

export function PlanBrowser({ kind }: { kind: PlanKind }) {
  const Icon = ICON_BY_KIND[kind];
  const athletes = useAthletes();
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [selectedAthlete, setSelectedAthlete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanEntry | null>(null);

  const filteredAthletes = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = (athletes.data ?? []).filter((athlete) =>
      athlete.name.toLowerCase().includes(query)
    );
    return list.sort((a, b) =>
      sortOrder === "newest"
        ? b.joinedAt.localeCompare(a.joinedAt)
        : a.joinedAt.localeCompare(b.joinedAt)
    );
  }, [athletes.data, search, sortOrder]);

  const plans = usePlans(
    kind,
    { athleteId: selectedAthlete?.id ?? "" },
    !!selectedAthlete
  );

  if (athletes.isLoading) {
    return <TableCardSkeleton />;
  }

  if (selectedAthlete) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => setSelectedAthlete(null)}>
          <ChevronLeft />
          بازگشت به لیست ورزشکاران
        </Button>

        <Card className="gap-4 py-5">
          <div className="px-6">
            <CardTitle className="text-base">
              برنامه‌های {selectedAthlete.name}
            </CardTitle>
          </div>
          <div className="space-y-2 px-6">
            {plans.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : !plans.data || plans.data.length === 0 ? (
              <EmptyState
                icon={Icon}
                title="هنوز برنامه‌ای ثبت نشده است."
                description="با ورود به پروفایل ورزشکار می‌توانید برنامه جدیدی برایش ثبت کنید."
              />
            ) : (
              plans.data.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan)}
                  className="flex w-full items-center justify-between rounded-xl border border-border p-4 text-right transition-colors hover:bg-muted/50"
                >
                  <span className="font-medium text-foreground">
                    {plan.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatPersianDate(new Date(plan.assignedAt))}
                  </span>
                </button>
              ))
            )}
          </div>
        </Card>

        <Dialog
          open={!!selectedPlan}
          onOpenChange={(open) => !open && setSelectedPlan(null)}
        >
          {selectedPlan && (
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{selectedPlan.title}</DialogTitle>
                <DialogDescription>
                  تخصیص داده شده در{" "}
                  {formatPersianDate(new Date(selectedPlan.assignedAt))}
                </DialogDescription>
              </DialogHeader>
              <p className="whitespace-pre-line text-sm text-foreground">
                {selectedPlan.description || "توضیحاتی برای این برنامه ثبت نشده است."}
              </p>
            </DialogContent>
          )}
        </Dialog>
      </div>
    );
  }

  if ((athletes.data?.length ?? 0) === 0) {
    return (
      <Card className="py-5">
        <EmptyState
          icon={Users}
          title="هنوز ورزشکاری ثبت نشده است."
          description="ابتدا از بخش ورزشکاران، یک ورزشکار اضافه کنید."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی نام و نام خانوادگی ورزشکار..."
            className="pr-10"
          />
        </div>
        <Select
          value={sortOrder}
          onValueChange={(value) => setSortOrder(value as SortOrder)}
        >
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">جدیدترین به قدیمی‌ترین</SelectItem>
            <SelectItem value="oldest">قدیمی‌ترین به جدیدترین</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredAthletes.length === 0 ? (
        <Card className="py-5">
          <EmptyState
            icon={Search}
            title="نتیجه‌ای پیدا نشد."
            description="ورزشکاری با این نام و نام خانوادگی پیدا نشد."
          />
        </Card>
      ) : (
        <Card className="gap-4 py-5">
          <div className="space-y-2 px-6">
            {filteredAthletes.map((athlete) => (
              <button
                key={athlete.id}
                type="button"
                onClick={() => setSelectedAthlete(athlete)}
                className="flex w-full items-center gap-3 rounded-xl border border-border p-4 text-right transition-colors hover:bg-muted/50"
              >
                <Avatar className="size-9">
                  <AvatarFallback className="text-xs">
                    {athlete.name.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {athlete.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    عضویت از {formatPersianDate(new Date(athlete.joinedAt))}
                  </p>
                </div>
                <ChevronLeft className="size-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
