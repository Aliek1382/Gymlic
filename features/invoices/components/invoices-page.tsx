"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber, formatPersianDate, toPersianDigits } from "@/lib/persian";
import { RoleGate } from "@/features/authentication/components/role-gate";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { INVOICE_ITEM_LABEL, INVOICE_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "../constants";
import { useInvoices } from "../hooks/use-invoices";
import type { InvoiceStatus } from "../types/invoice-types";

const FILTERS: { value: InvoiceStatus | "all"; label: string }[] = [
  { value: "all", label: "همه" },
  { value: "pending", label: INVOICE_STATUS_LABEL.pending },
  { value: "paid", label: INVOICE_STATUS_LABEL.paid },
  { value: "cancelled", label: INVOICE_STATUS_LABEL.cancelled },
];

const STATUS_VARIANT = { pending: "warning", paid: "success", cancelled: "secondary" } as const;

/** Every invoice the trainer has issued, across their whole roster. */
export function InvoicesPage() {
  const invoices = useInvoices();
  const [filter, setFilter] = useState<InvoiceStatus | "all">("all");

  const rows = (invoices.data ?? []).filter((row) => filter === "all" || row.status === filter);
  const pendingTotal = (invoices.data ?? [])
    .filter((row) => row.status === "pending")
    .reduce((sum, row) => sum + row.amountToman, 0);

  return (
    <RoleGate allow={["trainer"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">فاکتورهای من</h1>
          <p className="text-sm text-muted-foreground">
            فاکتورهایی که برای برنامه‌ها و پکیج‌های جلسه‌ی ورزشکاران خود صادر کرده‌اید. پرداخت
            هر فاکتور را از صفحه برنامه‌ها یا صفحه‌ی همان ورزشکار ثبت کنید.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                filter === item.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {item.label}
            </button>
          ))}
          {pendingTotal > 0 && (
            <span className="text-xs text-muted-foreground">
              مجموع در انتظار پرداخت: {formatNumber(pendingTotal)} تومان
            </span>
          )}
        </div>

        <Card className="gap-4 py-5">
          {invoices.isLoading ? (
            <div className="space-y-2 px-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="فاکتوری وجود ندارد."
              description="روی هر برنامه، دکمه «تعیین قیمت» فاکتور می‌سازد."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>شماره</TableHead>
                  <TableHead>ورزشکار</TableHead>
                  <TableHead>برنامه</TableHead>
                  <TableHead>مبلغ (تومان)</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead>تاریخ صدور</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{toPersianDigits(row.number)}</TableCell>
                    <TableCell className="text-foreground">{row.athleteName}</TableCell>
                    <TableCell>
                      {row.itemTitle ?? "—"}
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        · {INVOICE_ITEM_LABEL[row.itemType]}
                      </span>
                    </TableCell>
                    <TableCell>{formatNumber(row.amountToman)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[row.status]}>
                        {INVOICE_STATUS_LABEL[row.status]}
                        {row.paymentMethod && ` · ${PAYMENT_METHOD_LABEL[row.paymentMethod]}`}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatPersianDate(new Date(row.createdAt))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </RoleGate>
  );
}
