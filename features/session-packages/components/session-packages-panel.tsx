"use client";

import { CalendarCheck } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { useSessionPackages } from "../hooks/use-session-packages";
import { SellPackageDialog } from "./sell-package-dialog";
import { SessionPackageCard } from "./session-package-card";

/** "Private sessions" section of an athlete's profile, for their trainer. */
export function SessionPackagesPanel({ athleteId }: { athleteId: string }) {
  const packages = useSessionPackages(athleteId);

  return (
    <Card className="gap-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6">
        <div>
          <h2 className="text-base font-bold text-foreground">جلسات خصوصی</h2>
          <p className="text-xs text-muted-foreground">
            پکیج جلسه بفروشید، بعد از پرداخت هر جلسه را برنامه‌ریزی و برگزاری آن را ثبت کنید.
          </p>
        </div>
        <SellPackageDialog athleteId={athleteId} />
      </div>

      <div className="space-y-3 px-6">
        {packages.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : packages.isError ? (
          <p className="text-sm text-destructive">دریافت پکیج‌ها با خطا مواجه شد.</p>
        ) : !packages.data || packages.data.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="هنوز پکیجی فروخته نشده است."
            description="با دکمه‌ی «فروش پکیج جلسه» اولین پکیج را بسازید."
          />
        ) : (
          packages.data.map((pkg) => <SessionPackageCard key={pkg.id} pkg={pkg} />)
        )}
      </div>
    </Card>
  );
}
