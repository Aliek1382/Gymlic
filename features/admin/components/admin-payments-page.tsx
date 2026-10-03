"use client";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber, formatPersianDate, formatToman } from "@/lib/persian";
import { useQuery } from "@tanstack/react-query";

import { listPaymentRequests, type AdminPaymentRequestRow } from "../services/admin-service";
import { ExportButton } from "./export-button";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { PaymentRequestActions } from "@/features/admin/components/payment-request-actions";
import { waitingDays } from "@/features/finance/components/payment-form-bits";
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
  | "amount_mismatch"
  | "plan_price_toman"
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
              {request.club_name}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {request.plan_name}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatToman(request.amount_toman)} تومان
              {request.amount_mismatch && request.status === "pending" && (
                <p className="text-xs font-medium text-warning">
                  با قیمت پلن ({formatNumber(request.plan_price_toman ?? 0)} تومان) فرق دارد
                </p>
              )}
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
              {request.status === "pending" && waitingDays(request.created_at) >= 1 && (
                <p className="text-xs font-medium text-warning">
                  {formatNumber(waitingDays(request.created_at))} روز در انتظار
                </p>
              )}
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

export function AdminPaymentsPage() {
  const { data } = useQuery({
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

  const pending = data?.pending ?? [];
  const reviewed = data?.reviewed ?? [];

  return (

    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">درخواست‌های پرداخت</h1>
          <p className="text-sm text-muted-foreground">
            بررسی و تایید واریزی‌هایی که باشگاه‌ها برای فعال‌سازی اشتراک ثبت کرده‌اند.
          </p>
        </div>
        <ExportButton kind="payments" />
      </div>

      <Card className="gap-4 py-5">
        <Tabs defaultValue="pending">
          <div className="px-6">
            <CardTitle className="sr-only">درخواست‌های پرداخت</CardTitle>
            <TabsList>
              <TabsTrigger value="pending">
                در انتظار ({formatNumber(pending.length)})
              </TabsTrigger>
              <TabsTrigger value="reviewed">
                بررسی‌شده ({formatNumber(reviewed.length)})
              </TabsTrigger>
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
    </div>
  );
}
