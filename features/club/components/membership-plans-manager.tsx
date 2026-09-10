"use client";

import { useState } from "react";
import { Layers, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, toPersianDigits } from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { useDeleteMembershipPlan } from "../hooks/use-delete-membership-plan";
import { useMembershipPlans } from "../hooks/use-membership-plans";
import type { MembershipPlan } from "../types/club-types";
import { MembershipPlanFormDialog } from "./membership-plan-form-dialog";

function PlanRow({ clubId, plan }: { clubId: string; plan: MembershipPlan }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deletePlan = useDeleteMembershipPlan();

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{plan.name}</span>
          {!plan.isActive && <Badge variant="secondary">غیرفعال</Badge>}
          {plan.memberCount > 0 && (
            <Badge variant="info">
              {toPersianDigits(plan.memberCount)} عضو
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {formatNumber(plan.priceToman)} تومان ·{" "}
          {toPersianDigits(plan.durationDays)} روز
        </p>
        {plan.description && (
          <p className="text-xs text-muted-foreground">{plan.description}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <MembershipPlanFormDialog clubId={clubId} plan={plan} />
        <Button
          size="icon"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          aria-label={`حذف طرح ${plan.name}`}
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 />
        </Button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`حذف طرح ${plan.name}`}
        description={
          plan.memberCount > 0
            ? `${toPersianDigits(plan.memberCount)} عضو روی این طرح هستند. با حذف طرح، عضویت آن‌ها باقی می‌ماند ولی بدون طرح نمایش داده می‌شود. اگر فقط می‌خواهید این طرح دیگر پیشنهاد نشود، به‌جای حذف آن را غیرفعال کنید.`
            : "این طرح حذف می‌شود و دیگر هنگام افزودن عضو پیشنهاد نخواهد شد."
        }
        confirmLabel="بله، حذف کن"
        errorMessage="حذف طرح با خطا مواجه شد."
        onConfirm={() => deletePlan.mutateAsync(plan.id)}
      />
    </div>
  );
}

/** The club's own membership plans — what it sells, priced and timed. */
export function MembershipPlansManager({ clubId }: { clubId: string }) {
  const plans = useMembershipPlans(clubId);

  return (
    <Card className="gap-4 py-5">
      <div className="flex flex-col gap-3 px-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">طرح‌های عضویت</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            طرح‌هایی که باشگاه شما می‌فروشد: نام، قیمت و مدت هر کدام.
          </p>
        </div>
        <MembershipPlanFormDialog clubId={clubId} />
      </div>

      <div className="space-y-2 px-6">
        {plans.isLoading ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : plans.isError ? (
          <p className="text-sm text-destructive">
            دریافت طرح‌های عضویت با خطا مواجه شد.
          </p>
        ) : (plans.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={Layers}
            title="هنوز طرحی تعریف نشده است."
            description="با دکمه «طرح جدید» اولین طرح عضویت باشگاه خود را بسازید."
          />
        ) : (
          plans.data?.map((plan) => (
            <PlanRow key={plan.id} clubId={clubId} plan={plan} />
          ))
        )}
      </div>
    </Card>
  );
}
