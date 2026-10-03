"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Paperclip, Wallet, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { JalaliDateField } from "@/components/ui/jalali-date-field";
import { Label } from "@/components/ui/label";
import { CancelRequestButton } from "@/features/finance/components/cancel-request-button";
import { AmountToPay, PaidAmountField, parsePaidAmount } from "@/features/finance/components/payment-form-bits";
import { PaymentInfoCard } from "@/features/finance/components/payment-info-card";
import { ReceiptViewer } from "@/features/finance/components/receipt-viewer";
import { getBillingInfo, prepareReceipt, type DiscountQuote } from "@/features/finance/services/finance-service";
import { todayIso } from "@/lib/iso-date";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatPersianDate, formatToman, toAsciiDigits } from "@/lib/persian";
import { useCancelInvoiceClaim, useSubmitInvoiceClaim } from "../hooks/use-invoice-claims";
import { useMyInvoices } from "../hooks/use-my-invoices";
import { checkInvoiceDiscount } from "../services/invoice-service";

/**
 * Athlete side of a pending invoice: where to send the card-to-card payment
 * and a form to say "I paid" (tracking code, last four card digits, receipt).
 * The plan stays locked until the trainer approves; a rejection comes back
 * with the trainer's reason and the athlete may file again.
 */
export function PayInvoiceCard({ invoiceId }: { invoiceId: string }) {
  const mine = useMyInvoices();
  const [open, setOpen] = useState(false);
  const cancel = useCancelInvoiceClaim();

  const invoice = mine.data?.invoices.find((row) => row.id === invoiceId);
  if (!invoice || invoice.status !== "pending") return null;

  const claimsEnabled = mine.data?.claimsEnabled === true;
  const claim = invoice.claim;
  const waiting = claim?.status === "pending";
  const payTo = invoice.payTo;
  const hasAccount = !!payTo && (payTo.cardNumber || payTo.sheba);

  return (
    <div className="space-y-3 text-start">
      {hasAccount && !waiting && <AmountToPay amount={invoice.amountToman} />}

      {hasAccount ? (
        <PaymentInfoCard
          info={{
            card_number: payTo.cardNumber,
            sheba: payTo.sheba,
            account_holder: payTo.holderName,
            bank_name: payTo.bankName,
            instructions: "",
          }}
        />
      ) : (
        <p className="rounded-xl border border-dashed border-border p-3 text-xs leading-5 text-muted-foreground">
          مربی هنوز شمارهٔ کارت خود را در سایت ثبت نکرده است. روش پرداخت را از خود مربی بپرسید.
        </p>
      )}

      {claimsEnabled && waiting && claim && (
        <div className="space-y-2 rounded-xl border border-warning/30 bg-warning-muted p-3 text-sm">
          <Badge variant="warning">در انتظار تأیید مربی</Badge>
          <p className="text-xs text-muted-foreground">
            پرداخت شما با کد پیگیری <span dir="ltr" className="font-mono">{claim.trackingCode}</span> در{" "}
            {formatPersianDate(new Date(claim.createdAt.replace(" ", "T")))} ثبت شد. بعد از تأیید مربی،
            محتوا برای شما باز می‌شود.
          </p>
          {claim.discountToman > 0 && claim.listPriceToman != null && (
            <p className="text-xs text-muted-foreground">
              با کد تخفیف <span dir="ltr" className="font-mono">{claim.discountCode}</span>:{" "}
              {formatToman(claim.listPriceToman - claim.discountToman)} تومان
            </p>
          )}
          {claim.hasReceipt && (
            <ReceiptViewer requestId={claim.id} kind="invoice-claim" isPdf={claim.receiptIsPdf} />
          )}
          <CancelRequestButton onCancel={() => cancel.mutateAsync(invoiceId)} queryKeys={[]} />
        </div>
      )}

      {claimsEnabled && claim?.status === "rejected" && (
        <div className="space-y-1 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <Badge variant="destructive">پرداخت قبلی تأیید نشد</Badge>
          <p className="text-xs text-muted-foreground">
            {claim.trainerNote ?? "برای پیگیری با مربی خود صحبت کنید."}
          </p>
        </div>
      )}

      {claimsEnabled && !waiting && (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Wallet />
          {claim?.status === "rejected" ? "ثبت دوبارهٔ پرداخت" : "پرداخت کردم"}
        </Button>
      )}

      {claimsEnabled && (
        <ClaimDialog
          invoiceId={invoiceId}
          amount={invoice.amountToman}
          discountsEnabled={mine.data?.discountsEnabled === true}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </div>
  );
}

function ClaimDialog({
  invoiceId,
  amount,
  discountsEnabled,
  open,
  onOpenChange,
}: {
  invoiceId: string;
  /** The invoice amount, before any discount code. */
  amount: number;
  discountsEnabled: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const submit = useSubmitInvoiceClaim();
  const [trackingCode, setTrackingCode] = useState("");
  const [cardLast4, setCardLast4] = useState("");
  const [paidAt, setPaidAt] = useState(todayIso());
  const [paidAmount, setPaidAmount] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [discountText, setDiscountText] = useState("");
  const [quote, setQuote] = useState<DiscountQuote | null>(null);
  const [checking, setChecking] = useState(false);
  const price = quote ? quote.final_toman : amount;

  async function applyCode() {
    if (!discountText.trim()) return;
    setChecking(true);
    try {
      setQuote(await checkInvoiceDiscount(invoiceId, discountText.trim()));
      setError(null);
      toast.success("کد تخفیف اعمال شد.");
    } catch (e) {
      setQuote(null);
      toast.error(getErrorMessage(e, "بررسی کد تخفیف ناموفق بود."));
    } finally {
      setChecking(false);
    }
  }

  const { data: billing } = useQuery({
    queryKey: ["finance", "billing-info"],
    queryFn: getBillingInfo,
    enabled: open,
  });
  const rules = billing?.receipts ?? null;

  async function handleSubmit() {
    const code = toAsciiDigits(trackingCode).replace(/\s+/g, "");
    const last4 = toAsciiDigits(cardLast4).trim();
    if (!/^[A-Za-z0-9_/-]{4,40}$/.test(code)) {
      setError("کد پیگیری باید بین ۴ تا ۴۰ حرف یا رقم باشد.");
      return;
    }
    if (!/^\d{4}$/.test(last4)) {
      setError("چهار رقم آخر کارت خود را وارد کنید.");
      return;
    }
    if (parsePaidAmount(paidAmount ?? String(price)) === null) {
      setError("مبلغی را که واریز کرده‌اید به تومان وارد کنید.");
      return;
    }
    if (rules?.required !== false && !receipt) {
      setError("تصویر یا فایل رسید پرداخت را پیوست کنید.");
      return;
    }
    setError(null);

    try {
      const prepared = receipt ? await prepareReceipt(receipt) : null;
      if (prepared && rules && prepared.size > rules.max_mb * 1024 * 1024) {
        setError(`حجم رسید باید حداکثر ${rules.max_mb} مگابایت باشد.`);
        return;
      }
      await submit.mutateAsync({
        invoiceId,
        trackingCode: code,
        cardLast4: last4,
        paidAt: paidAt || undefined,
        paidAmount: parsePaidAmount(paidAmount ?? String(price)) ?? undefined,
        note: note.trim() || undefined,
        discountCode: quote?.code,
        receipt: prepared,
      });
      toast.success("پرداخت شما ثبت شد و در انتظار تأیید مربی است.");
      setTrackingCode("");
      setCardLast4("");
      setPaidAt(todayIso());
      setPaidAmount(null);
      setNote("");
      setReceipt(null);
      setDiscountText("");
      setQuote(null);
      onOpenChange(false);
    } catch (e) {
      setError(getErrorMessage(e, "ثبت پرداخت با خطا مواجه شد."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ثبت پرداخت کارت‌به‌کارت</DialogTitle>
          <DialogDescription>
            {quote
              ? `مبلغ ${formatToman(quote.final_toman)} تومان را به کارت مربی واریز کنید`
              : "بعد از واریز به کارت مربی"}
            ، اطلاعات پرداخت را اینجا ثبت کنید. محتوا بعد از تأیید مربی باز می‌شود.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {discountsEnabled && (
            <div className="space-y-2">
              <Label htmlFor="claim-discount">
                کد تخفیف مربی <span className="text-muted-foreground">(اگر دارید)</span>
              </Label>
              {quote ? (
                <div className="space-y-1 rounded-xl border border-success/30 bg-success-muted px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      کد <span dir="ltr" className="font-mono font-medium">{quote.code}</span> اعمال شد
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setQuote(null)}
                      aria-label="حذف کد تخفیف"
                    >
                      <X />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="line-through">{formatToman(amount)}</span> ←{" "}
                    <span className="font-medium text-foreground">{formatToman(quote.final_toman)} تومان</span>{" "}
                    ({formatToman(quote.discount_toman)} تومان تخفیف)
                  </p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    id="claim-discount"
                    dir="ltr"
                    value={discountText}
                    maxLength={40}
                    className="font-mono uppercase"
                    onChange={(e) => setDiscountText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void applyCode();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={applyCode}
                    disabled={checking || !discountText.trim()}
                  >
                    {checking && <Loader2 className="animate-spin" />}
                    اعمال
                  </Button>
                </div>
              )}
            </div>
          )}

          <AmountToPay amount={price} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="claim-tracking">کد پیگیری واریز</Label>
              <Input
                id="claim-tracking"
                dir="ltr"
                maxLength={40}
                autoComplete="off"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="claim-last4">چهار رقم آخر کارت شما</Label>
              <Input
                id="claim-last4"
                dir="ltr"
                inputMode="numeric"
                maxLength={4}
                autoComplete="off"
                value={cardLast4}
                onChange={(e) => setCardLast4(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="claim-receipt">
              تصویر رسید{" "}
              <span className="text-muted-foreground">
                {rules?.required === false ? "(اختیاری)" : "(الزامی)"}
              </span>
            </Label>
            <label
              htmlFor="claim-receipt"
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-input px-4 py-3 text-sm text-muted-foreground hover:bg-accent"
            >
              <Paperclip className="size-4 shrink-0" />
              <span className="truncate">{receipt ? receipt.name : "انتخاب عکس یا فایل PDF"}</span>
            </label>
            <input
              id="claim-receipt"
              type="file"
              accept="image/*,application/pdf"
              className="sr-only"
              onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
            />
            {rules && (
              <p className="text-xs text-muted-foreground">
                عکس قبل از ارسال کوچک می‌شود. حداکثر {rules.max_mb} مگابایت
                {rules.retention_days > 0
                  ? `؛ فایل ${rules.retention_days} روز پس از بررسی حذف می‌شود.`
                  : "."}
              </p>
            )}
          </div>

          <PaidAmountField
            id="claim-paid-amount"
            value={paidAmount ?? String(price)}
            onChange={setPaidAmount}
            expected={price}
          />

          <JalaliDateField id="claim-paid-at" label="تاریخ واریز" value={paidAt} onChange={setPaidAt} />

          <div className="space-y-2">
            <Label htmlFor="claim-note">
              توضیح برای مربی <span className="text-muted-foreground">(اختیاری)</span>
            </Label>
            <Input id="claim-note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submit.isPending}>
            {submit.isPending && <Loader2 className="animate-spin" />}
            ثبت پرداخت
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
