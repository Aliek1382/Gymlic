"use client";

import { Wallet } from "lucide-react";

import { Card, CardTitle } from "@/components/ui/card";
import { formatNumber, formatPersianDate } from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { parseIsoDate } from "../utils/iso-date";
import type { TrainerPayment } from "../types/earnings-types";
import { PaymentFormDialog } from "./payment-form-dialog";
import { DeletePaymentButton } from "./delete-payment-button";

/** The full ledger, newest payment first. */
export function PaymentLog({ payments }: { payments: TrainerPayment[] }) {
  return (
    <Card className="gap-4 py-5">
      <div className="px-6">
        <CardTitle className="text-base">تاریخچه‌ی پرداخت‌ها</CardTitle>
      </div>
      <div className="space-y-2 px-6">
        {payments.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="هنوز پرداختی ثبت نشده است."
            description="با دکمه «ثبت پرداخت جدید» اولین شهریه‌ی دریافتی را وارد کنید."
          />
        ) : (
          payments.map((payment) => (
            <div
              key={payment.id}
              className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {payment.athleteName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatPersianDate(parseIsoDate(payment.paidAt))}
                  </span>
                </div>
                {/* The exact amount, not formatToman's "۲٫۵ میلیون" rounding —
                    a ledger row has to reconcile against what was received. */}
                <p className="text-sm text-muted-foreground">
                  {formatNumber(payment.amountToman)} تومان
                </p>
                {payment.note && (
                  <p className="text-xs text-muted-foreground">{payment.note}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <PaymentFormDialog payment={payment} />
                <DeletePaymentButton payment={payment} />
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
