"use client";

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
import { useQuery } from "@tanstack/react-query";

import { formatPersianDate, formatToman } from "@/lib/persian";
import { getClubRow } from "@/features/club/services/club-service";
import {
  listCatalogPlans,
  listPaymentRequests,
} from "@/features/admin/services/admin-service";
import { RoleGate } from "@/features/authentication/components/role-gate";
import { useAuthContext } from "@/features/authentication/hooks/use-auth-context";
import { SubscriptionCard } from "@/features/dashboard/components/shared/subscription-card";
import { SubmitPaymentRequestDialog } from "./submit-payment-request-dialog";
import { ClubRevenueSection } from "@/features/revenue";
import type { PaymentRequestStatus, SubscriptionStatus } from "@/types/database.types";

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

export function FinancePage() {
  const { data: context } = useAuthContext();
  const clubId = context?.activeMembership?.clubId ?? "";

  const { data } = useQuery({
    queryKey: ["finance", "club", clubId],
    enabled: clubId.length > 0,
    queryFn: async () => {
      const [club, plans, requests] = await Promise.all([
        getClubRow(clubId),
        listCatalogPlans(),
        listPaymentRequests(),
      ]);

      return {
        club,
        plans: plans.filter((plan) => plan.is_active),
        requests: requests.filter((request) => request.club_id === clubId),
      };
    },
  });

  const club = data?.club;
  const subscription =
    club?.subscription_status && club.subscription_expires_at
      ? {
          planName: club.subscription_plan_name ?? "",
          status: club.subscription_status as SubscriptionStatus,
          expiresAt: club.subscription_expires_at,
          remainingDays: Math.ceil(
            (new Date(club.subscription_expires_at).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24)
          ),
        }
      : null;

  const availablePlans = (data?.plans ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    priceToman: p.price_toman,
    durationDays: p.duration_days,
  }));

  const requestRows = data?.requests ?? [];

  return (
    <RoleGate allow={["club"]}>

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
                          {request.plan_name}
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
    </RoleGate>
  );
}
