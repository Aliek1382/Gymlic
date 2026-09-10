"use client";

import { useRouter } from "next/navigation";
import { Phone } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAge, formatPersianDate } from "@/lib/persian";
import { ProgressPageContent } from "@/features/progress/components/progress-page-content";
import { useAthleteProfile } from "../hooks/use-athlete-profile";
import { useRemoveAthlete } from "../hooks/use-remove-athlete";
import { AthleteProfileNote } from "./athlete-profile-note";
import { PlanDialog } from "./plan-dialog";
import { RemoveAthleteButton } from "./remove-athlete-button";

export function AthleteProfileContent({ athleteId }: { athleteId: string }) {
  const profile = useAthleteProfile(athleteId);
  const removeAthlete = useRemoveAthlete();
  const router = useRouter();

  if (profile.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <Card className="border-destructive/30 py-5">
        <p className="px-6 text-sm text-destructive">
          دریافت اطلاعات ورزشکار با خطا مواجه شد. صفحه را دوباره بارگذاری کنید.
        </p>
      </Card>
    );
  }

  const athlete = profile.data;
  const age = formatAge(athlete.birthDate);

  return (
    <div className="space-y-4">
      <Card className="gap-4 py-5">
        <div className="flex flex-col gap-4 px-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="size-14">
              {athlete.avatarUrl && <AvatarImage src={athlete.avatarUrl} />}
              <AvatarFallback>{athlete.name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-bold text-foreground">
                {athlete.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {age && <>{age} · </>}
                عضویت از {formatPersianDate(new Date(athlete.joinedAt))}
              </p>
              {athlete.phone && (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="size-3" />
                  {athlete.phone}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PlanDialog
              kind="workout"
              target={{ athleteId }}
              athleteName={athlete.name}
            />
            <PlanDialog
              kind="nutrition"
              target={{ athleteId }}
              athleteName={athlete.name}
            />
            <RemoveAthleteButton
              athleteName={athlete.name}
              description="این ورزشکار از لیست شما حذف می‌شود. برنامه‌های قبلی او حذف نخواهند شد."
              onConfirm={async () => {
                await removeAthlete.mutateAsync(athleteId);
                router.push("/athletes");
              }}
            />
          </div>
        </div>
      </Card>

      <AthleteProfileNote athleteId={athleteId} initialNote={athlete.note} />

      <ProgressPageContent athleteId={athleteId} />
    </div>
  );
}
