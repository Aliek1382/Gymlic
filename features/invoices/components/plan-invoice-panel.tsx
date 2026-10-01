"use client";

import { useState } from "react";
import { Loader2, Lock, Receipt } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumber, normalizeAmount } from "@/lib/persian";
import { getErrorMessage } from "@/lib/get-error-message";
import { PAYMENT_METHOD_LABEL } from "../constants";
import { useCancelInvoice } from "../hooks/use-cancel-invoice";
import { useCreateInvoice } from "../hooks/use-create-invoice";
import { useInvoices } from "../hooks/use-invoices";
import { useMarkInvoicePaid } from "../hooks/use-mark-invoice-paid";
import { useTrainerPaymentInfo } from "../hooks/use-trainer-payment-info";
import { ClaimReview } from "./claim-review";
import type { InvoiceItemType, ManualPaymentMethod } from "../types/invoice-types";

/**
 * Trainer's pricing controls for one plan: set a price (which locks the plan
 * for the athlete), then settle it by hand as cash or card-to-card, or cancel.
 */
export function PlanInvoicePanel({
  kind,
  planId,
  athleteId,
}: {
  kind: "workout" | "nutrition";
  planId: string;
  athleteId: string;
}) {
  const itemType: InvoiceItemType = kind === "workout" ? "workout_plan" : "nutrition_plan";
  const invoices = useInvoices(athleteId);
  const createInvoice = useCreateInvoice();
  const markPaid = useMarkInvoicePaid();
  const cancelInvoice = useCancelInvoice();
  const paymentInfo = useTrainerPaymentInfo();

  const [priceOpen, setPriceOpen] = useState(false);
  const [amountText, setAmountText] = useState("");
  const [payMethod, setPayMethod] = useState<ManualPaymentMethod | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const invoice = invoices.data?.find(
    (row) => row.itemType === itemType && row.itemId === planId && row.status !== "cancelled"
  );

  if (invoices.isLoading) return null;

  async function handleCreate() {
    const amount = Number(normalizeAmount(amountText));
    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error("مبلغ را به‌صورت عدد صحیح و بزرگ‌تر از صفر (تومان) وارد کنید.");
      return;
    }
    try {
      await createInvoice.mutateAsync({ itemType, itemId: planId, amountToman: amount });
      toast.success("فاکتور صادر شد و برنامه تا زمان پرداخت برای ورزشکار قفل است.");
      setPriceOpen(false);
      setAmountText("");
    } catch (error) {
      toast.error(getErrorMessage(error, "صدور فاکتور با خطا مواجه شد."));
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Receipt className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">هزینه برنامه</span>
        {invoice?.status === "pending" && (
          <Badge variant="warning">
            <Lock className="size-3" />
            قفل تا پرداخت
          </Badge>
        )}
        {invoice?.status === "paid" && <Badge variant="success">پرداخت‌شده</Badge>}
      </div>

      {!invoice && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            با تعیین قیمت، محتوای این برنامه تا ثبت پرداخت برای ورزشکار قفل می‌شود.
          </p>
          <Button size="sm" variant="outline" onClick={() => setPriceOpen(true)}>
            تعیین قیمت
          </Button>
        </div>
      )}

      {invoice && (
        <p className="text-sm text-foreground">
          {formatNumber(invoice.amountToman)} تومان
          {invoice.status === "paid" && invoice.paymentMethod && (
            <span className="text-muted-foreground">
              {" "}
              · {PAYMENT_METHOD_LABEL[invoice.paymentMethod]}
            </span>
          )}
        </p>
      )}

      {invoice?.status === "pending" && (
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

      {invoice?.status === "pending" && paymentInfo.data?.ready && !paymentInfo.data.info.card_number && (
        <p className="text-xs text-muted-foreground">
          برای پرداخت کارت‌به‌کارت ورزشکار، شمارهٔ کارت خود را در «تنظیمات» ثبت کنید.
        </p>
      )}

      {invoice && <ClaimReview invoice={invoice} />}

      <Dialog open={priceOpen} onOpenChange={setPriceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعیین قیمت برنامه</DialogTitle>
            <DialogDescription>
              پس از صدور فاکتور، ورزشکار فقط مبلغ را می‌بیند و محتوای برنامه تا ثبت پرداخت توسط شما پنهان می‌ماند.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="invoice-amount">مبلغ (تومان)</Label>
            <Input
              id="invoice-amount"
              inputMode="numeric"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder="مثلاً ۵۰۰٬۰۰۰"
            />
          </div>
          <Button onClick={handleCreate} disabled={createInvoice.isPending}>
            {createInvoice.isPending && <Loader2 className="animate-spin" />}
            صدور فاکتور و قفل برنامه
          </Button>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={payMethod !== null}
        onOpenChange={(open) => !open && setPayMethod(null)}
        title="ثبت پرداخت"
        description={
          invoice && payMethod
            ? `دریافت ${formatNumber(invoice.amountToman)} تومان به‌صورت ${PAYMENT_METHOD_LABEL[payMethod]} ثبت می‌شود و برنامه بلافاصله برای ورزشکار باز می‌شود.`
            : ""
        }
        confirmLabel="تایید پرداخت"
        errorMessage="ثبت پرداخت با خطا مواجه شد."
        onConfirm={async () => {
          if (!invoice || !payMethod) return;
          await markPaid.mutateAsync({ id: invoice.id, paymentMethod: payMethod });
          toast.success("پرداخت ثبت شد و برنامه برای ورزشکار باز است.");
        }}
      />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="لغو فاکتور"
        description="با لغو فاکتور، برنامه دوباره برای ورزشکار باز می‌شود. می‌توانید بعداً فاکتور تازه‌ای صادر کنید."
        confirmLabel="لغو فاکتور"
        errorMessage="لغو فاکتور با خطا مواجه شد."
        onConfirm={async () => {
          if (!invoice) return;
          await cancelInvoice.mutateAsync(invoice.id);
          toast.success("فاکتور لغو شد.");
        }}
      />
    </div>
  );
}
