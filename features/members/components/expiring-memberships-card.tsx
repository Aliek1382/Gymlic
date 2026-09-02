"use client";

import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { parseIsoDate } from "@/lib/iso-date";
import { formatPersianDate, toPersianDigits } from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ChartCardSkeleton } from "@/features/dashboard/components/shared/dashboard-skeleton";
import { useClubMembers } from "../hooks/use-club-members";
import { daysUntilExpiry, expiryState } from "../utils/membership-expiry";

const VISIBLE_ROWS = 5;

/**
 * The dashboard's standing reminder of who is about to lapse — expired
 * first, then whoever is closest to it.
 */
export function ExpiringMembershipsCard({ clubId }: { clubId: string }) {
  const members = useClubMembers(clubId);

  if (members.isLoading) return <ChartCardSkeleton />;

  const atRisk = (members.data ?? [])
    .filter((member) => {
      if (member.status === "suspended") return false;
      const state = expiryState(member.expiresAt);
      return state === "expiring" || state === "expired";
    })
    .sort(
      (a, b) => (daysUntilExpiry(a.expiresAt) ?? 0) - (daysUntilExpiry(b.expiresAt) ?? 0)
    );

  return (
    <Card className="gap-4 py-5">
      <div className="flex items-center justify-between px-6">
        <CardTitle className="text-base">عضویت‌های رو به انقضا</CardTitle>
        {atRisk.length > 0 && (
          <Button asChild size="sm" variant="outline">
            <Link href="/members">مدیریت اعضا</Link>
          </Button>
        )}
      </div>

      <div className="space-y-2 px-6">
        {atRisk.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="عضویت رو به انقضایی ندارید."
            description="هر عضوی که تاریخ پایان عضویتش نزدیک شود، همین‌جا دیده می‌شود."
          />
        ) : (
          <>
            {atRisk.slice(0, VISIBLE_ROWS).map((member) => {
              const days = daysUntilExpiry(member.expiresAt) ?? 0;
              return (
                <Link
                  key={member.membershipId}
                  href={`/members/${member.membershipId}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {member.name}
                    </p>
                    {member.expiresAt && (
                      <p className="text-xs text-muted-foreground">
                        {formatPersianDate(parseIsoDate(member.expiresAt))}
                      </p>
                    )}
                  </div>
                  {days < 0 ? (
                    <Badge variant="destructive">منقضی‌شده</Badge>
                  ) : (
                    <Badge variant="warning">
                      {days === 0 ? "امروز" : `${toPersianDigits(days)} روز`}
                    </Badge>
                  )}
                </Link>
              );
            })}
            {atRisk.length > VISIBLE_ROWS && (
              <p className="text-xs text-muted-foreground">
                و {toPersianDigits(atRisk.length - VISIBLE_ROWS)} عضویت دیگر
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
