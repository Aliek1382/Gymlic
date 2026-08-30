import { Tags } from "lucide-react";

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
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { PlanActiveToggle } from "@/features/admin/components/plan-active-toggle";
import { PlanFormDialog } from "@/features/admin/components/plan-form-dialog";

export const metadata = { title: "پلن‌ها | پنل مدیریت جیم‌لیک" };

export default async function AdminPlansPage() {
  const supabase = await createClient();

  const { data: plans } = await supabase
    .from("plans")
    .select("id, name, price_toman, duration_days, max_members, is_active")
    .order("price_toman", { ascending: true });

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
        <PlanFormDialog />
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
                <TableHead>فعال</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium text-foreground">{plan.name}</TableCell>
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
                  <TableCell>
                    <PlanActiveToggle planId={plan.id} isActive={plan.is_active} />
                  </TableCell>
                  <TableCell>
                    <PlanFormDialog
                      plan={{
                        id: plan.id,
                        name: plan.name,
                        priceToman: plan.price_toman,
                        durationDays: plan.duration_days,
                        maxMembers: plan.max_members,
                      }}
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
