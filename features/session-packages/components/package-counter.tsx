import { Progress } from "@/components/ui/progress";
import { toPersianDigits } from "@/lib/persian";
import type { SessionPackage } from "../types/session-package-types";

/** "N of M sessions held" — a cancelled session isn't held, but no longer counts as remaining. */
export function PackageCounter({ pkg }: { pkg: SessionPackage }) {
  const remaining = Math.max(pkg.totalSessions - pkg.doneSessions - pkg.canceledSessions, 0);
  const percent = Math.round((pkg.doneSessions / pkg.totalSessions) * 100);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-foreground">
          {toPersianDigits(pkg.doneSessions)} از {toPersianDigits(pkg.totalSessions)} جلسه برگزار شده
        </span>
        <span className="text-xs text-muted-foreground">
          {toPersianDigits(remaining)} جلسه باقی‌مانده
          {pkg.canceledSessions > 0 && <> · {toPersianDigits(pkg.canceledSessions)} لغوشده</>}
        </span>
      </div>
      <Progress value={percent} />
    </div>
  );
}
