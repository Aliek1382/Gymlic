import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPersianDate, formatToman } from "@/lib/persian";
import { createClient } from "@/lib/supabase/server";
import { getServerAuthContext } from "@/features/authentication/services/auth-server";
import { SubscriptionCard } from "@/features/dashboard/components/shared/subscription-card";
import { SubmitPaymentRequestDialog } from "@/features/finance/components/submit-payment-request-dialog";
import { ClubRevenueSection } from "@/features/revenue";
import type { PaymentRequestStatus, SubscriptionStatus } from "@/types/database.types";

export const metadata = { title: "امور مالی | جیم‌لیک" };

const REQUEST_STATUS_LABEL: Record<PaymentRequestStatus, string> = {
  pending: "در انتظار بررسی",
  approved: "تاییدشده",
  rejected: "ردشده",
};

const REQUEST_STATUS_VARIANT: Record<PaymentRequestStatus, "warning" | "success" | "destructive"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
};

export default async function FinancePage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "club") redirect("/dashboard");

  const clubId = context.activeMembership!.clubId;
  const supabase = await createClient();

  const [{ data: subscriptionRow }, { data: plans }, { data: requests }] =
    await Promise.all([
      supabase
        .from("subscriptions")
        .select("plan_name, status, expires_at")
        .eq("club_id", clubId)
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("plans")
        .select("id, name, price_toman, duration_days")
        .eq("is_active", true)
        .order("price_toman", { ascending: true }),
      supabase
        .from("payment_requests")
        .select("id, amount_toman, status, admin_note, created_at, plans(name)")
        .eq("club_id", clubId)
        .order("created_at", { ascending: false })
        .returns<
          {
            id: string;
            amount_toman: number;
            status: PaymentRequestStatus;
            admin_note: string | null;
            created_at: string;
            plans: { name: string } | null;
          }[]
        >(),
    ]);

  const subscription = subscriptionRow
    ? {
        planName: subscriptionRow.plan_name,
        status: subscriptionRow.status as SubscriptionStatus,
        expiresAt: subscriptionRow.expires_at,
        remainingDays: Math.ceil(
          (new Date(subscriptionRow.expires_at).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        ),
      }
    : null;

  const availablePlans = (plans ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    priceToman: p.price_toman,
    durationDays: p.duration_days,
  }));

  const requestRows = requests ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">امور مالی باشگاه</h1>
        <p className="text-sm text-muted-foreground">
          درآمد و شهریه‌های دریافتی باشگاه، و وضعیت اشتراک شما در پلتفرم.
        </p>
      </div>

      <Tabs defaultValue="revenue" className="space-y-6">
        <TabsList>
          <TabsTrigger value="revenue">درآمد باشگاه</TabsTrigger>
          <TabsTrigger value="subscription">اشتراک پلتفرم</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <ClubRevenueSection clubId={clubId} />
        </TabsContent>

        <TabsContent value="subscription" className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              اشتراک باشگاه شما در جیم‌لیک و تاریخچه‌ی درخواست‌های پرداخت آن.
            </p>
            <SubmitPaymentRequestDialog plans={availablePlans} />
          </div>

          <SubscriptionCard subscription={subscription} />

          <Card className="gap-4 py-5">
            <div className="px-6">
              <CardTitle className="text-base">تاریخچه درخواست‌های پرداخت</CardTitle>
            </div>

            {requestRows.length === 0 ? (
              <p className="px-6 text-sm text-muted-foreground">
                هنوز درخواست پرداختی ثبت نکرده‌اید.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>پلن</TableHead>
                    <TableHead>مبلغ</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead>یادداشت مدیریت</TableHead>
                    <TableHead>تاریخ ثبت</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requestRows.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="text-foreground">
                        {request.plans?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatToman(request.amount_toman)} تومان
                      </TableCell>
                      <TableCell>
                        <Badge variant={REQUEST_STATUS_VARIANT[request.status]}>
                          {REQUEST_STATUS_LABEL[request.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {request.admin_note ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatPersianDate(new Date(request.created_at))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
