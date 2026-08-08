"use client";

import { useMemo, useState } from "react";
import { Clock, Copy, Search, Users } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPersianDate, toPersianDigits } from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { TableCardSkeleton } from "@/features/dashboard/components/shared/dashboard-skeleton";
import { ATHLETE_SORT_LABEL, type AthleteSortOrder } from "../constants/athletes";
import { useAthletes } from "../hooks/use-athletes";
import { usePendingAthleteInvites } from "../hooks/use-pending-athlete-invites";
import { useRemoveAthlete } from "../hooks/use-remove-athlete";
import { useRevokeAthleteInvite } from "../hooks/use-revoke-athlete-invite";
import { PlanDialog } from "./plan-dialog";
import { RemoveAthleteButton } from "./remove-athlete-button";

function compareByCount(
  order: AthleteSortOrder,
  a: { workoutPlanCount: number; nutritionPlanCount: number },
  b: { workoutPlanCount: number; nutritionPlanCount: number }
): number | null {
  switch (order) {
    case "most-workout":
      return b.workoutPlanCount - a.workoutPlanCount;
    case "fewest-workout":
      return a.workoutPlanCount - b.workoutPlanCount;
    case "most-nutrition":
      return b.nutritionPlanCount - a.nutritionPlanCount;
    case "fewest-nutrition":
      return a.nutritionPlanCount - b.nutritionPlanCount;
    default:
      return null;
  }
}

export function AthleteList() {
  const athletes = useAthletes();
  const pendingInvites = usePendingAthleteInvites();
  const removeAthlete = useRemoveAthlete();
  const revokeInvite = useRevokeAthleteInvite();
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<AthleteSortOrder>("newest");

  const hasAthletes = (athletes.data?.length ?? 0) > 0;
  const hasPendingInvites = (pendingInvites.data?.length ?? 0) > 0;

  const filteredPendingInvites = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = (pendingInvites.data ?? []).filter((invite) =>
      invite.name.toLowerCase().includes(query)
    );
    return list.sort((a, b) => {
      const byCount = compareByCount(sortOrder, a, b);
      if (byCount !== null) return byCount;
      return sortOrder === "newest"
        ? b.createdAt.localeCompare(a.createdAt)
        : a.createdAt.localeCompare(b.createdAt);
    });
  }, [pendingInvites.data, search, sortOrder]);

  const filteredAthletes = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = (athletes.data ?? []).filter((athlete) =>
      athlete.name.toLowerCase().includes(query)
    );
    return list.sort((a, b) => {
      const byCount = compareByCount(sortOrder, a, b);
      if (byCount !== null) return byCount;
      return sortOrder === "newest"
        ? b.joinedAt.localeCompare(a.joinedAt)
        : a.joinedAt.localeCompare(b.joinedAt);
    });
  }, [athletes.data, search, sortOrder]);

  if (athletes.isLoading || pendingInvites.isLoading) {
    return <TableCardSkeleton />;
  }

  if (!hasAthletes && !hasPendingInvites) {
    return (
      <Card className="py-5">
        <EmptyState
          icon={Users}
          title="هنوز ورزشکاری ثبت نشده است."
          description="با دکمه «افزودن ورزشکار جدید» اولین ورزشکار خود را ثبت کنید."
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
          onValueChange={(value) => setSortOrder(value as AthleteSortOrder)}
        >
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ATHLETE_SORT_LABEL) as AthleteSortOrder[]).map((value) => (
              <SelectItem key={value} value={value}>
                {ATHLETE_SORT_LABEL[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {athletes.isError && (
        <Card className="border-destructive/30 py-5">
          <p className="px-6 text-sm text-destructive">
            دریافت لیست ورزشکاران با خطا مواجه شد. صفحه را دوباره بارگذاری کنید.
          </p>
        </Card>
      )}

      {search.trim() &&
        filteredPendingInvites.length === 0 &&
        filteredAthletes.length === 0 && (
          <Card className="py-5">
            <EmptyState
              icon={Search}
              title="نتیجه‌ای پیدا نشد."
              description="ورزشکاری با این نام و نام خانوادگی پیدا نشد."
            />
          </Card>
        )}

      {filteredPendingInvites.length > 0 && (
        <Card className="gap-4 py-5">
          <div className="px-6">
            <CardTitle className="text-base">دعوت‌های در انتظار</CardTitle>
          </div>
          <div className="space-y-2 px-6">
            {filteredPendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="size-9">
                    <AvatarFallback className="text-xs">
                      {invite.name.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {invite.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {invite.heightCm
                        ? `قد: ${toPersianDigits(invite.heightCm)} سانتی‌متر`
                        : ""}
                      {invite.heightCm && invite.weightKg ? " · " : ""}
                      {invite.weightKg
                        ? `وزن: ${toPersianDigits(invite.weightKg)} کیلوگرم`
                        : ""}
                    </p>
                    {(invite.workoutPlanCount > 0 || invite.nutritionPlanCount > 0) && (
                      <p className="text-xs text-muted-foreground">
                        {toPersianDigits(invite.workoutPlanCount)} برنامه تمرینی ·{" "}
                        {toPersianDigits(invite.nutritionPlanCount)} برنامه غذایی
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="warning">
                    <Clock className="size-3" />
                    در انتظار پذیرش
                  </Badge>
                  <PlanDialog
                    kind="workout"
                    target={{ invitationId: invite.id }}
                    athleteName={invite.name}
                  />
                  <PlanDialog
                    kind="nutrition"
                    target={{ invitationId: invite.id }}
                    athleteName={invite.name}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await navigator.clipboard.writeText(
                        `${window.location.origin}/join/${invite.code}`
                      );
                      toast.success("لینک دعوت کپی شد.");
                    }}
                  >
                    <Copy />
                    کپی لینک
                  </Button>
                  <RemoveAthleteButton
                    athleteName={invite.name}
                    description="این دعوت لغو می‌شود و لینک آن دیگر کار نخواهد کرد."
                    onConfirm={() => revokeInvite.mutateAsync(invite.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {filteredAthletes.length > 0 && (
        <Card className="gap-4 py-5">
          <div className="px-6">
            <CardTitle className="text-base">ورزشکاران من</CardTitle>
          </div>
          <div className="space-y-2 px-6">
            {filteredAthletes.map((athlete) => (
              <div
                key={athlete.id}
                className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="size-9">
                    <AvatarFallback className="text-xs">
                      {athlete.name.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {athlete.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      عضویت از {formatPersianDate(new Date(athlete.joinedAt))} ·{" "}
                      {toPersianDigits(athlete.workoutPlanCount)} برنامه تمرینی ·{" "}
                      {toPersianDigits(athlete.nutritionPlanCount)} برنامه غذایی
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <PlanDialog
                    kind="workout"
                    target={{ athleteId: athlete.id }}
                    athleteName={athlete.name}
                  />
                  <PlanDialog
                    kind="nutrition"
                    target={{ athleteId: athlete.id }}
                    athleteName={athlete.name}
                  />
                  <RemoveAthleteButton
                    athleteName={athlete.name}
                    description="این ورزشکار از لیست شما حذف می‌شود. برنامه‌های قبلی او حذف نخواهند شد."
                    onConfirm={() => removeAthlete.mutateAsync(athlete.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
