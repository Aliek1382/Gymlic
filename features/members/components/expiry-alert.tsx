"use client";

import { AlertTriangle, CalendarClock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toPersianDigits } from "@/lib/persian";
import { type ExpiryFilter } from "../constants/members";
import { EXPIRING_SOON_DAYS } from "../utils/membership-expiry";

/**
 * The one thing a club should not have to go looking for: who is about to
 * lapse, and who already has. Clicking a count filters the list below.
 */
export function ExpiryAlert({
  expiringCount,
  expiredCount,
  onFilter,
}: {
  expiringCount: number;
  expiredCount: number;
  onFilter: (filter: ExpiryFilter) => void;
}) {
  if (expiringCount === 0 && expiredCount === 0) return null;

  return (
    <Card className="flex flex-col gap-3 border-warning/40 bg-warning-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning-muted text-warning">
          <AlertTriangle className="size-4" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            عضویت‌هایی نیاز به پیگیری دارند
          </p>
          <p className="text-xs text-muted-foreground">
            {expiringCount > 0 && (
              <>
                {toPersianDigits(expiringCount)} عضویت تا{" "}
                {toPersianDigits(EXPIRING_SOON_DAYS)} روز آینده تمام می‌شود
              </>
            )}
            {expiringCount > 0 && expiredCount > 0 && " · "}
            {expiredCount > 0 && (
              <>{toPersianDigits(expiredCount)} عضویت منقضی شده است</>
            )}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        {expiringCount > 0 && (
          <Button size="sm" variant="outline" onClick={() => onFilter("expiring")}>
            <CalendarClock />
            رو به انقضا
          </Button>
        )}
        {expiredCount > 0 && (
          <Button size="sm" variant="outline" onClick={() => onFilter("expired")}>
            <AlertTriangle />
            منقضی‌شده
          </Button>
        )}
      </div>
    </Card>
  );
}
