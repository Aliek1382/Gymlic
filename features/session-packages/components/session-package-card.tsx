"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCancelInvoice } from "@/features/invoices/hooks/use-cancel-invoice";
import { useMarkInvoicePaid } from "@/features/invoices/hooks/use-mark-invoice-paid";
import { PAYMENT_METHOD_LABEL } from "@/features/invoices/constants";
import type { ManualPaymentMethod } from "@/features/invoices/types/invoice-types";
import { formatNumber, formatPersianDate } from "@/lib/persian";
import { PACKAGE_STATUS_LABEL, PACKAGE_STATUS_VARIANT } from "../constants";
import type { SessionPackage } from "../types/session-package-types";
import { PackageCounter } from "./package-counter";
import { PackageSessionList } from "./package-session-list";

/** One package on the trainer's side: settle or void its invoice, then run its sessions. */
export function SessionPackageCard({ pkg }: { pkg: SessionPackage }) {
  const markPaid = useMarkInvoicePaid();
  const cancelInvoice = useCancelInvoice();
  const [payMethod, setPayMethod] = useState<ManualPaymentMethod | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const awaitingPayment = pkg.status === "pending_payment" && pkg.invoiceId !== null;
  const hasSessions = pkg.status === "active" || pkg.status === "completed";

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">{pkg.title}</p>
          <p className="text-xs text-muted-foreground">
            {formatNumber(pkg.amountToman)} تومان
            {pkg.discountToman > 0 && <> · با {formatNumber(pkg.discountToman)} تومان تخفیف</>}
            {" · "}
            {formatPersianDate(new Date(pkg.createdAt.replace(" ", "T")))}
          </p>
        </div>
        <Badge variant={PACKAGE_STATUS_VARIANT[pkg.status]}>{PACKAGE_STATUS_LABEL[pkg.status]}</Badge>
      </div>

      {awaitingPayment && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setPayMethod("cash")}>
            ثبت پرداخت نقدی
          </Button>
          <Button size="sm" onClick={() => setPayMethod("card_transfer")}>
            ثبت پرداخت کارت‌به‌کارت
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCancelOpen(true)}>
            لغو فاکتور
          </Button>
        </div>
      )}

      {hasSessions && (
        <>
          <PackageCounter pkg={pkg} />
          <PackageSessionList packageId={pkg.id} editable={pkg.status === "active"} />
        </>
      )}

      <ConfirmDialog
        open={payMethod !== null}
        onOpenChange={(open) => !open && setPayMethod(null)}
        title="ثبت پرداخت"
        description={
          payMethod
            ? `دریافت ${formatNumber(pkg.amountToman)} تومان به‌صورت ${PAYMENT_METHOD_LABEL[payMethod]} ثبت می‌شود و ${formatNumber(pkg.totalSessions)} جلسه‌ی خالی برای این پکیج ساخته می‌شود.`
            : ""
        }
        confirmLabel="تایید پرداخت"
        errorMessage="ثبت پرداخت با خطا مواجه شد."
        onConfirm={async () => {
          if (!pkg.invoiceId || !payMethod) return;
          await markPaid.mutateAsync({ id: pkg.invoiceId, paymentMethod: payMethod });
          toast.success("پرداخت ثبت شد و پکیج فعال است.");
        }}
      />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="لغو فاکتور و پکیج"
        description="با لغو فاکتور، این پکیج هم لغو می‌شود و ورزشکار دیگر آن را نمی‌بیند. برای فروش دوباره باید پکیج تازه‌ای ثبت کنید."
        confirmLabel="لغو فاکتور"
        errorMessage="لغو فاکتور با خطا مواجه شد."
        onConfirm={async () => {
          if (!pkg.invoiceId) return;
          await cancelInvoice.mutateAsync(pkg.invoiceId);
          toast.success("فاکتور و پکیج لغو شد.");
        }}
      />
    </div>
  );
}
