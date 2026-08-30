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
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { PaymentRequestActions } from "@/features/admin/components/payment-request-actions";
import type { PaymentRequestStatus } from "@/types/database.types";

export const metadata = { title: "درخواست‌های پرداخت | پنل مدیریت جیم‌لیک" };

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

interface RequestRow {
  id: string;
  amount_toman: number;
  reference_note: string | null;
  status: PaymentRequestStatus;
  admin_note: string | null;
  created_at: string;
  clubs: { name: string } | null;
  plans: { name: string } | null;
}

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
              {request.clubs?.name ?? "—"}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {request.plans?.name ?? "—"}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatToman(request.amount_toman)} تومان
            </TableCell>
            <TableCell className="max-w-48 truncate text-muted-foreground">
              {request.reference_note ?? "—"}
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

export default async function AdminPaymentsPage() {
  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("payment_requests")
    .select(
      "id, amount_toman, reference_note, status, admin_note, created_at, clubs(name), plans(name)"
    )
    .order("created_at", { ascending: false })
    .returns<RequestRow[]>();

  const rows = requests ?? [];
  const pending = rows.filter((r) => r.status === "pending");
  const reviewed = rows.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">درخواست‌های پرداخت</h1>
        <p className="text-sm text-muted-foreground">
          بررسی و تایید واریزی‌هایی که باشگاه‌ها برای فعال‌سازی اشتراک ثبت کرده‌اند.
        </p>
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
