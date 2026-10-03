"use client";

import { Tags } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber, formatToman } from "@/lib/persian";
import { listCatalogPlans } from "../services/admin-service";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { PlanActiveToggle } from "./plan-active-toggle";
import { PlanFormDialog } from "./plan-form-dialog";

export function AdminPlansPage() {
  const { data: plans } = useQuery({
    queryKey: ["admin", "plans"],
    queryFn: listCatalogPlans,
  });

  const rows = plans ?? [];

  return (

    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">پلن‌ها</h1>
          <p className="text-sm text-muted-foreground">
            کاتالوگ رسمی پلن‌های اشتراک که باشگاه‌ها می‌توانند برای آن‌ها پرداخت کنند.
          </p>
        </div>
        <PlanFormDialog withTrainerCap={rows.some((p) => p.max_trainers !== undefined)} />
      </div>

      <Card className="gap-4 py-5">
        <div className="px-6">
          <CardTitle className="text-base">
            لیست پلن‌ها ({formatNumber(rows.length)})
          </CardTitle>
        </div>

        {rows.length === 0 ? (
          <div className="px-6">
            <EmptyState
              icon={Tags}
              title="هنوز پلنی تعریف نشده است."
              description="اولین پلن اشتراک را برای باشگاه‌ها تعریف کنید."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>نام پلن</TableHead>
                <TableHead>قیمت</TableHead>
                <TableHead>مدت</TableHead>
                <TableHead>سقف عضو</TableHead>
                <TableHead>سقف مربی</TableHead>
                <TableHead>فعال</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium text-foreground">
                    {plan.name}
                    {plan.is_free && (
                      <p className="text-xs font-normal text-muted-foreground">
                        رایگان: پلن هر باشگاهی که اشتراک ندارد
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatToman(plan.price_toman)} تومان
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatNumber(plan.duration_days)} روز
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {plan.max_members != null
                      ? `${formatNumber(plan.max_members)} نفر`
                      : "بدون محدودیت"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {plan.max_trainers === undefined
                      ? "—"
                      : plan.max_trainers != null
                        ? `${formatNumber(plan.max_trainers)} نفر`
                        : "بدون محدودیت"}
                  </TableCell>
                  <TableCell>
                    {plan.is_free ? (
                      <span className="text-xs text-muted-foreground">همیشه</span>
                    ) : (
                      <PlanActiveToggle planId={plan.id} isActive={plan.is_active} />
                    )}
                  </TableCell>
                  <TableCell>
                    <PlanFormDialog
                      plan={{
                        id: plan.id,
                        name: plan.name,
                        priceToman: plan.price_toman,
                        durationDays: plan.duration_days,
                        maxMembers: plan.max_members,
                        maxTrainers: plan.max_trainers,
                      }}
                      withTrainerCap={plan.max_trainers !== undefined}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
