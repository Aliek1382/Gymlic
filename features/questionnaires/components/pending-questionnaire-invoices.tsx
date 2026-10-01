"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ClaimReview } from "@/features/invoices/components/claim-review";
import { PAYMENT_METHOD_LABEL } from "@/features/invoices/constants";
import { useCancelInvoice } from "@/features/invoices/hooks/use-cancel-invoice";
import { useInvoices } from "@/features/invoices/hooks/use-invoices";
import { useMarkInvoicePaid } from "@/features/invoices/hooks/use-mark-invoice-paid";
import type { Invoice, ManualPaymentMethod } from "@/features/invoices/types/invoice-types";
import { formatNumber } from "@/lib/persian";

/**
 * Priced questionnaires an athlete hasn't paid for yet. The trainer settles
 * them here (cash or card-to-card), which opens the questions for the athlete,
 * or cancels the invoice, which opens them without payment.
 */
export function PendingQuestionnaireInvoices() {
  const invoices = useInvoices();
  const markPaid = useMarkInvoicePaid();
  const cancelInvoice = useCancelInvoice();
  const [paying, setPaying] = useState<{ invoice: Invoice; method: ManualPaymentMethod } | null>(null);
  const [cancelling, setCancelling] = useState<Invoice | null>(null);

  const pending = (invoices.data ?? []).filter(
    (row) => row.itemType === "questionnaire" && row.status === "pending"
  );
  if (pending.length === 0) return null;

  return (
    <Card className="gap-3 py-5">
      <div className="px-6">
        <h2 className="text-base font-bold text-foreground">در انتظار پرداخت</h2>
        <p className="text-xs text-muted-foreground">
          تا ثبت پرداخت، سؤالات این پرسشنامه‌ها برای ورزشکار قفل است.
        </p>
      </div>
      <ul className="space-y-2 px-6">
        {pending.map((invoice) => (
          <li key={invoice.id} className="space-y-2 rounded-xl border border-border p-3">
            <p className="flex items-center gap-2 text-sm text-foreground">
              <Lock className="size-4 text-muted-foreground" />
              {invoice.athleteName} · {invoice.itemTitle ?? "پرسشنامه"} · {formatNumber(invoice.amountToman)} تومان
            </p>
            <ClaimReview invoice={invoice} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setPaying({ invoice, method: "cash" })}>
                ثبت پرداخت نقدی
              </Button>
              <Button size="sm" onClick={() => setPaying({ invoice, method: "card_transfer" })}>
                ثبت پرداخت کارت‌به‌کارت
              </Button>
              <Button size="sm" variant="outline" onClick={() => setCancelling(invoice)}>
                لغو فاکتور
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={paying !== null}
        onOpenChange={(open) => !open && setPaying(null)}
        title="ثبت پرداخت"
        description={
          paying
            ? `دریافت ${formatNumber(paying.invoice.amountToman)} تومان به‌صورت ${PAYMENT_METHOD_LABEL[paying.method]} ثبت می‌شود و سؤالات بلافاصله برای ورزشکار باز می‌شود.`
            : ""
        }
        confirmLabel="تایید پرداخت"
        errorMessage="ثبت پرداخت با خطا مواجه شد."
        onConfirm={async () => {
          if (!paying) return;
          await markPaid.mutateAsync({ id: paying.invoice.id, paymentMethod: paying.method });
          toast.success("پرداخت ثبت شد و پرسشنامه برای ورزشکار باز است.");
        }}
      />

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        title="لغو فاکتور"
        description="با لغو فاکتور، سؤالات بدون پرداخت برای ورزشکار باز می‌شود."
        confirmLabel="لغو فاکتور"
        errorMessage="لغو فاکتور با خطا مواجه شد."
        onConfirm={async () => {
          if (!cancelling) return;
          await cancelInvoice.mutateAsync(cancelling.id);
          toast.success("فاکتور لغو شد.");
        }}
      />
    </Card>
  );
}
