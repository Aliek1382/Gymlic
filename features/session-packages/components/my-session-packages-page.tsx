"use client";

import { CalendarCheck, Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleGate } from "@/features/authentication/components/role-gate";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { PayInvoiceCard } from "@/features/invoices/components/pay-invoice-card";
import { formatNumber, toPersianDigits } from "@/lib/persian";
import { PACKAGE_STATUS_LABEL, PACKAGE_STATUS_VARIANT } from "../constants";
import { useMySessionPackages } from "../hooks/use-my-session-packages";
import type { SessionPackage } from "../types/session-package-types";
import { PackageCounter } from "./package-counter";
import { PackageSessionList } from "./package-session-list";

/** Sessions stay hidden until the trainer records the payment — like a locked plan. */
function LockedPackage({ pkg }: { pkg: SessionPackage }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border bg-muted/40 p-4 text-center">
      <Lock className="size-5 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">
        مبلغ فاکتور: {formatNumber(pkg.amountToman)} تومان
      </p>
      <p className="text-xs text-muted-foreground">
        برای فعال‌شدن {formatNumber(pkg.totalSessions)} جلسه، هزینه را با مربی خود تسویه کنید.
      </p>
      {pkg.invoiceId && (
        <p className="text-xs text-muted-foreground">
          شماره فاکتور: {toPersianDigits(pkg.invoiceId.slice(0, 8).toUpperCase())}
        </p>
      )}
      {pkg.invoiceId && (
        <div className="mt-2 w-full">
          <PayInvoiceCard invoiceId={pkg.invoiceId} />
        </div>
      )}
    </div>
  );
}

/** The athlete's own private-session packages. */
export function MySessionPackagesPage() {
  const packages = useMySessionPackages();

  return (
    <RoleGate allow={["athlete"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">جلسات خصوصی</h1>
          <p className="text-sm text-muted-foreground">
            پکیج‌های جلسه‌ای که مربی برای شما ثبت کرده است و زمان هر جلسه.
          </p>
        </div>

        {packages.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : packages.isError ? (
          <Card className="border-destructive/30 py-5">
            <p className="px-6 text-sm text-destructive">
              دریافت پکیج‌ها با خطا مواجه شد. صفحه را دوباره بارگذاری کنید.
            </p>
          </Card>
        ) : !packages.data || packages.data.length === 0 ? (
          <Card className="py-5">
            <EmptyState
              icon={CalendarCheck}
              title="هنوز پکیج جلسه‌ای ندارید."
              description="به محض ثبت پکیج توسط مربی، اینجا نمایش داده می‌شود."
            />
          </Card>
        ) : (
          packages.data.map((pkg) => (
            <Card key={pkg.id} className="gap-4 py-5">
              <div className="flex flex-wrap items-center justify-between gap-2 px-6">
                <div>
                  <p className="font-medium text-foreground">{pkg.title}</p>
                  <p className="text-xs text-muted-foreground">مربی: {pkg.trainerName}</p>
                </div>
                <Badge variant={PACKAGE_STATUS_VARIANT[pkg.status]}>
                  {PACKAGE_STATUS_LABEL[pkg.status]}
                </Badge>
              </div>

              <div className="space-y-3 px-6">
                {pkg.status === "pending_payment" ? (
                  <LockedPackage pkg={pkg} />
                ) : (
                  <>
                    <PackageCounter pkg={pkg} />
                    <PackageSessionList packageId={pkg.id} editable={false} />
                  </>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </RoleGate>
  );
}
