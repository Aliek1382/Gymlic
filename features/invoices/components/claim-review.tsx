"use client";

import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { PaymentFlags, waitingDays } from "@/features/finance/components/payment-form-bits";
import { ReceiptViewer } from "@/features/finance/components/receipt-viewer";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber, formatPersianDate } from "@/lib/persian";
import { useApproveInvoiceClaim, useRejectInvoiceClaim } from "../hooks/use-invoice-claims";
import type { Invoice } from "../types/invoice-types";

/**
 * Trainer side: the payment an athlete says they made against an invoice. The
 * trainer checks it against their bank app, then approves (which settles the
 * invoice and opens the content) or rejects with a reason.
 */
export function ClaimReview({ invoice }: { invoice: Invoice }) {
  const approve = useApproveInvoiceClaim();
  const reject = useRejectInvoiceClaim();
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");

  const claim = invoice.claim;
  if (invoice.status !== "pending" || !claim) return null;

  if (claim.status === "rejected") {
    return (
      <p className="text-xs text-muted-foreground">
        آخرین پرداخت ثبت‌شده تأیید نشد
        {claim.trainerNote ? ` (${claim.trainerNote})` : ""}. منتظر ثبت دوبارهٔ ورزشکار است.
      </p>
    );
  }
  if (claim.status !== "pending") return null;

  function close() {
    setMode(null);
    setNote("");
  }

  async function confirm() {
    try {
      if (mode === "approve") {
        await approve.mutateAsync(invoice.id);
        toast.success("پرداخت تأیید شد و محتوا برای ورزشکار باز است.");
      } else {
        await reject.mutateAsync({ invoiceId: invoice.id, note: note.trim() || undefined });
        toast.success("پرداخت رد شد و به ورزشکار اطلاع داده شد.");
      }
      close();
    } catch (error) {
      toast.error(getErrorMessage(error, "ثبت تصمیم با خطا مواجه شد."));
    }
  }

  const busy = approve.isPending || reject.isPending;

  return (
    <div className="space-y-2 rounded-xl border border-warning/30 bg-warning-muted p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="warning">ورزشکار پرداخت را ثبت کرد</Badge>
        {claim.duplicateTracking && <Badge variant="destructive">کد پیگیری تکراری</Badge>}
        <PaymentFlags
          mismatch={claim.amountMismatch}
          paidAmount={claim.paidAmountToman}
          expected={claim.discountToman > 0 && claim.listPriceToman != null ? claim.listPriceToman - claim.discountToman : invoice.amountToman}
        />
      </div>
      <div className="space-y-0.5 text-xs text-muted-foreground">
        <p>
          کد پیگیری: <span dir="ltr" className="font-mono text-foreground">{claim.trackingCode}</span>
          {" · "}کارت ••••{" "}
          <span dir="ltr" className="font-mono text-foreground">{claim.cardLast4}</span>
        </p>
        {claim.discountToman > 0 && claim.listPriceToman != null && (
          <p className="font-medium text-foreground">
            با کد تخفیف <span dir="ltr" className="font-mono">{claim.discountCode}</span>: باید{" "}
            {formatNumber(claim.listPriceToman - claim.discountToman)} تومان واریز شده باشد (
            {formatNumber(claim.discountToman)} تومان تخفیف)
          </p>
        )}
        <p>
          مبلغ فاکتور: {formatNumber(invoice.amountToman)} تومان
          {claim.paidAt && <> · واریز: {formatPersianDate(new Date(claim.paidAt.replace(" ", "T")))}</>}
        </p>
        {waitingDays(claim.createdAt) >= 1 && (
          <p className="font-medium text-warning">{formatNumber(waitingDays(claim.createdAt))} روز است که منتظر پاسخ شما است</p>
        )}
        {claim.note && <p>توضیح ورزشکار: {claim.note}</p>}
        {!claim.hasReceipt && claim.receiptPurged && <p>فایل رسید حذف شده است.</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {claim.hasReceipt && (
          <ReceiptViewer requestId={claim.id} kind="invoice-claim" isPdf={claim.receiptIsPdf} />
        )}
        <Button size="sm" onClick={() => setMode("approve")} disabled={busy}>
          <Check />
          تأیید پرداخت
        </Button>
        <Button size="sm" variant="outline" onClick={() => setMode("reject")} disabled={busy}>
          <X />
          رد
        </Button>
      </div>

      <Dialog open={mode !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "approve" ? "تأیید پرداخت" : "رد پرداخت"}</DialogTitle>
            <DialogDescription>
              {mode === "approve"
                ? `دریافت ${formatNumber(
                    claim.discountToman > 0 && claim.listPriceToman != null
                      ? claim.listPriceToman - claim.discountToman
                      : invoice.amountToman
                  )} تومان به‌صورت کارت‌به‌کارت ثبت می‌شود و محتوا بلافاصله برای ورزشکار باز می‌شود. اول مطمئن شوید پول به حساب شما نشسته است.`
                : "ورزشکار با دلیل شما مطلع می‌شود و می‌تواند دوباره پرداخت را ثبت کند."}
            </DialogDescription>
          </DialogHeader>
          {mode === "reject" && (
            <div className="space-y-2">
              <Label htmlFor="claim-reject-note">
                دلیل رد <span className="text-muted-foreground">(اختیاری)</span>
              </Label>
              <Input
                id="claim-reject-note"
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="مثلاً: واریزی با این کد پیگیری به حساب من نرسیده است."
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>
              انصراف
            </Button>
            <Button
              variant={mode === "reject" ? "destructive" : "default"}
              onClick={confirm}
              disabled={busy}
            >
              {busy && <Loader2 className="animate-spin" />}
              {mode === "approve" ? "تأیید و باز کردن" : "رد پرداخت"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
