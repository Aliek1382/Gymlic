"use client";

import { Clock, Copy, Users } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { formatPersianDate, toPersianDigits } from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { TableCardSkeleton } from "@/features/dashboard/components/shared/dashboard-skeleton";
import { useAthletes } from "../hooks/use-athletes";
import { usePendingAthleteInvites } from "../hooks/use-pending-athlete-invites";
import { useRemoveAthlete } from "../hooks/use-remove-athlete";
import { useRevokeAthleteInvite } from "../hooks/use-revoke-athlete-invite";
import { PlanDialog } from "./plan-dialog";
import { RemoveAthleteButton } from "./remove-athlete-button";

export function AthleteList() {
  const athletes = useAthletes();
  const pendingInvites = usePendingAthleteInvites();
  const removeAthlete = useRemoveAthlete();
  const revokeInvite = useRevokeAthleteInvite();

  if (athletes.isLoading || pendingInvites.isLoading) {
    return <TableCardSkeleton />;
  }

  const hasAthletes = (athletes.data?.length ?? 0) > 0;
  const hasPendingInvites = (pendingInvites.data?.length ?? 0) > 0;

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
      {athletes.isError && (
        <Card className="border-destructive/30 py-5">
          <p className="px-6 text-sm text-destructive">
            دریافت لیست ورزشکاران با خطا مواجه شد. صفحه را دوباره بارگذاری کنید.
          </p>
        </Card>
      )}

      {hasPendingInvites && (
        <Card className="gap-4 py-5">
          <div className="px-6">
            <CardTitle className="text-base">دعوت‌های در انتظار</CardTitle>
          </div>
          <div className="space-y-2 px-6">
            {pendingInvites.data!.map((invite) => (
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

      {hasAthletes && (
        <Card className="gap-4 py-5">
          <div className="px-6">
            <CardTitle className="text-base">ورزشکاران من</CardTitle>
          </div>
          <div className="space-y-2 px-6">
            {athletes.data!.map((athlete) => (
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
                      عضویت از {formatPersianDate(new Date(athlete.joinedAt))}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
