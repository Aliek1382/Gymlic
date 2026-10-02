"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ReceiptText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber, formatPersianDate, formatToman } from "@/lib/persian";
import { useQuery } from "@tanstack/react-query";

import { listPaymentRequests, type AdminPaymentRequestRow } from "../services/admin-service";
import { ExportButton } from "./export-button";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import { TrainerRequestsTable } from "@/features/trainer-billing/components/trainer-payment-requests";
import { listTrainerRequests } from "@/features/trainer-billing/services/trainer-billing-service";
import { PaymentRequestActions } from "@/features/admin/components/payment-request-actions";
import { ReceiptViewer } from "@/features/finance/components/receipt-viewer";
import type { PaymentRequestStatus } from "@/types/database.types";

const STATUS_LABEL: Record<PaymentRequestStatus, string> = {
  pending: "در انتظار",
  approved: "تاییدشده",
  rejected: "ردشده",
};

const STATUS_VARIANT: Record<PaymentRequestStatus, "warning" | "success" | "destructive"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
};

type RequestRow = Pick<
  AdminPaymentRequestRow,
  | "id"
  | "club_id"
  | "amount_toman"
  | "reference_note"
  | "status"
  | "admin_note"
  | "created_at"
  | "club_name"
  | "plan_name"
  | "recorded_by_admin"
  | "list_price_toman"
  | "discount_toman"
  | "discount_code"
  | "tracking_code"
  | "card_last4"
  | "paid_at"
  | "has_receipt"
  | "receipt_is_pdf"
  | "receipt_purged_at"
  | "receipt_expires_at"
  | "duplicate_tracking"
>;

function RequestsTable({ rows, showActions }: { rows: RequestRow[]; showActions: boolean }) {
  if (rows.length === 0) {
    return (
      <div className="px-6 pb-6">
        <EmptyState
          icon={ReceiptText}
          title="درخواستی وجود ندارد."
          description="با ثبت درخواست پرداخت توسط باشگاه‌ها، اینجا نمایش داده می‌شود."
        />
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>باشگاه</TableHead>
          <TableHead>پلن</TableHead>
          <TableHead>مبلغ</TableHead>
          <TableHead>کد پیگیری</TableHead>
          <TableHead>رسید</TableHead>
          <TableHead>توضیح باشگاه</TableHead>
          <TableHead>تاریخ</TableHead>
          <TableHead>وضعیت</TableHead>
          {showActions && <TableHead>اقدام</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((request) => (
          <TableRow key={request.id}>
            <TableCell className="font-medium text-foreground">
              <Link href={`/admin/clubs/detail?id=${request.club_id}`} className="hover:underline">
                {request.club_name}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {request.plan_name}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatToman(request.amount_toman)} تومان
              {!!request.discount_toman && request.discount_toman > 0 && (
                <p className="text-xs">
                  {request.list_price_toman != null && (
                    <span className="line-through">{formatToman(request.list_price_toman)}</span>
                  )}{" "}
                  کد <span dir="ltr" className="font-mono">{request.discount_code ?? "—"}</span>
                  {" · "}
                  {formatToman(request.discount_toman)} تخفیف
                </p>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {request.tracking_code ? (
                <div className="space-y-1">
                  <p dir="ltr" className="text-end font-mono text-xs text-foreground">
                    {request.tracking_code}
                  </p>
                  <p className="text-xs">
                    کارت ••••{" "}
                    <span dir="ltr" className="font-mono">{request.card_last4}</span>
                  </p>
                  {request.paid_at && (
                    <p className="text-xs">واریز: {formatPersianDate(new Date(request.paid_at))}</p>
                  )}
                  {request.duplicate_tracking && (
                    <Badge variant="warning">کد پیگیری تکراری</Badge>
                  )}
                </div>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {request.has_receipt ? (
                <ReceiptViewer
                  requestId={request.id}
                  isPdf={request.receipt_is_pdf}
                  expiresAt={request.receipt_expires_at}
                  canDelete
                />
              ) : request.receipt_purged_at ? (
                <span className="text-xs">حذف شده</span>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell className="max-w-48 truncate text-muted-foreground">
              {request.recorded_by_admin ? (
                <Badge variant="secondary">ثبت دستی مدیر</Badge>
              ) : (
                (request.reference_note ?? "—")
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatPersianDate(new Date(request.created_at))}
            </TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[request.status]}>
                {STATUS_LABEL[request.status]}
              </Badge>
            </TableCell>
            {showActions && (
              <TableCell>
                <PaymentRequestActions requestId={request.id} />
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

type Who = "clubs" | "trainers";

/**
 * Every payment to the platform waiting on a review, clubs' and trainers'
 * side by side: the receipt, the tracking code, approve or reject.
 * ?tab=trainers opens on the trainers' (the link from «اشتراک مربیان»).
 */
export function AdminPaymentsPage() {
  const initial: Who = useSearchParams().get("tab") === "trainers" ? "trainers" : "clubs";
  const [who, setWho] = useState<Who>(initial);

  const clubs = useQuery({
    queryKey: ["admin", "payments"],
    queryFn: async () => {
      const rows = await listPaymentRequests();

      return {
        rows,
        pending: rows.filter((request) => request.status === "pending"),
        reviewed: rows.filter((request) => request.status !== "pending"),
      };
    },
  });
  const trainers = useQuery({ queryKey: ["admin", "trainer-requests"], queryFn: () => listTrainerRequests() });

  const pending = clubs.data?.pending ?? [];
  const reviewed = clubs.data?.reviewed ?? [];
  const trainerRows = trainers.data?.items ?? [];
  const trainerPending = trainerRows.filter((request) => request.status === "pending");
  const trainerReviewed = trainerRows.filter((request) => request.status !== "pending");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">درخواست‌های پرداخت</h1>
          <p className="text-sm text-muted-foreground">
            بررسی و تأیید واریزی‌هایی که باشگاه‌ها و مربیان برای خرید یا تمدید اشتراک ثبت کرده‌اند، با رسید و کد
            پیگیری هرکدام. با تأیید، اشتراک همان لحظه فعال یا تمدید می‌شود.
          </p>
        </div>
        <ExportButton
          kind={who === "trainers" ? "trainer-payments" : "payments"}
          label={who === "trainers" ? "خروجی پرداخت‌های مربیان" : "خروجی پرداخت‌های باشگاه‌ها"}
        />
      </div>

      <Tabs value={who} onValueChange={(value) => setWho(value as Who)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="clubs">باشگاه‌ها ({formatNumber(pending.length)} در انتظار)</TabsTrigger>
          <TabsTrigger value="trainers">مربیان ({formatNumber(trainerPending.length)} در انتظار)</TabsTrigger>
        </TabsList>

        <TabsContent value="clubs">
          <Card className="gap-4 py-5">
            <Tabs defaultValue="pending">
              <div className="px-6">
                <CardTitle className="sr-only">پرداخت‌های باشگاه‌ها</CardTitle>
                <TabsList>
                  <TabsTrigger value="pending">در انتظار ({formatNumber(pending.length)})</TabsTrigger>
                  <TabsTrigger value="reviewed">بررسی‌شده ({formatNumber(reviewed.length)})</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="pending">
                <RequestsTable rows={pending} showActions />
              </TabsContent>
              <TabsContent value="reviewed">
                <RequestsTable rows={reviewed} showActions={false} />
              </TabsContent>
            </Tabs>
          </Card>
        </TabsContent>

        <TabsContent value="trainers">
          <Card className="gap-4 py-5">
            {trainers.isLoading ? (
              <Skeleton className="mx-6 h-32" />
            ) : trainers.isError ? (
              <div className="px-6">
                <ErrorState message="دریافت پرداخت‌های مربیان ناموفق بود." />
              </div>
            ) : trainers.data && !trainers.data.ready ? (
              <p className="px-6 text-sm text-muted-foreground">
                اشتراک مربی هنوز فعال نشده است: به‌روزرسانی «اشتراک و پرداخت کارت‌به‌کارت مربی به پلتفرم» را از صفحهٔ
                پایگاه‌داده اجرا کنید.
              </p>
            ) : (
              <Tabs defaultValue="pending">
                <div className="px-6">
                  <CardTitle className="sr-only">پرداخت‌های مربیان</CardTitle>
                  <TabsList>
                    <TabsTrigger value="pending">در انتظار ({formatNumber(trainerPending.length)})</TabsTrigger>
                    <TabsTrigger value="reviewed">بررسی‌شده ({formatNumber(trainerReviewed.length)})</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="pending">
                  <TrainerRequestsTable rows={trainerPending} showActions />
                </TabsContent>
                <TabsContent value="reviewed">
                  <TrainerRequestsTable rows={trainerReviewed} showActions={false} />
                </TabsContent>
              </Tabs>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
