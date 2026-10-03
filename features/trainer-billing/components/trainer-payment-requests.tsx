"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, ReceiptText, X } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { PaymentFlags, waitingDays } from "@/features/finance/components/payment-form-bits";
import { ReceiptViewer } from "@/features/finance/components/receipt-viewer";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber, formatPersianDate, formatToman } from "@/lib/persian";
import {
  approveTrainerRequest,
  rejectTrainerRequest,
  type AdminTrainerRequest,
  type TrainerRequestStatus,
} from "../services/trainer-billing-service";

const STATUS_LABEL: Record<TrainerRequestStatus, string> = {
  pending: "در انتظار",
  approved: "تاییدشده",
  rejected: "ردشده",
};
const STATUS_VARIANT: Record<
  TrainerRequestStatus,
  "warning" | "success" | "destructive"
> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
};

const parseDate = (value: string) => new Date(value.replace(" ", "T"));
const fullName = (first: string | null, last: string | null) =>
  [first, last].filter(Boolean).join(" ") || "—";

/**
 * Trainers' payments to the platform: who, which plan, the tracking code and
 * the receipt, with approve / reject on the pending ones. In
 * /admin/payments (all trainers) and on a trainer's admin page (just theirs:
 * showTrainer off).
 */
export function TrainerRequestsTable({
  rows,
  showActions,
  showTrainer = true,
}: {
  rows: AdminTrainerRequest[];
  showActions: boolean;
  showTrainer?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="px-6 pb-6">
        <EmptyState
          icon={ReceiptText}
          title="درخواستی وجود ندارد."
          description="با ثبت پرداخت توسط مربیان، اینجا نمایش داده می‌شود."
        />
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showTrainer && <TableHead>مربی</TableHead>}
          <TableHead>پلن و مبلغ</TableHead>
          <TableHead>کد پیگیری</TableHead>
          <TableHead>رسید</TableHead>
          <TableHead>تاریخ</TableHead>
          <TableHead>وضعیت</TableHead>
          {showActions && <TableHead>اقدام</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((request) => (
          <TableRow key={request.id}>
            {showTrainer && (
              <TableCell>
                <Link
                  href={`/admin/trainers/detail?id=${request.trainer_id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {fullName(request.first_name, request.last_name)}
                </Link>
                {request.phone && (
                  <p
                    dir="ltr"
                    className="text-end text-xs text-muted-foreground"
                  >
                    {request.phone}
                  </p>
                )}
              </TableCell>
            )}
            <TableCell className="text-muted-foreground">
              {request.plan_name}
              <p className="text-xs">
                {formatToman(request.amount_toman)} تومان
              </p>
              {!!request.discount_toman && request.discount_toman > 0 && (
                <p className="text-xs">
                  {request.list_price_toman != null && (
                    <span className="line-through">
                      {formatToman(request.list_price_toman)}
                    </span>
                  )}{" "}
                  کد{" "}
                  <span dir="ltr" className="font-mono">
                    {request.discount_code ?? "—"}
                  </span>
                  {" · "}
                  {formatToman(request.discount_toman)} تخفیف
                </p>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {request.tracking_code === "DISCOUNT" ? (
                <Badge variant="secondary">تخفیف کامل، بدون پرداخت</Badge>
              ) : (
                <div className="space-y-1">
                  <p
                    dir="ltr"
                    className="text-end font-mono text-xs text-foreground"
                  >
                    {request.tracking_code}
                  </p>
                  <p className="text-xs">
                    کارت ••••{" "}
                    <span dir="ltr" className="font-mono">
                      {request.card_last4}
                    </span>
                  </p>
                  {request.paid_at && (
                    <p className="text-xs">
                      واریز: {formatPersianDate(parseDate(request.paid_at))}
                    </p>
                  )}
                  {request.duplicate_tracking && (
                    <Badge variant="warning">کد پیگیری تکراری</Badge>
                  )}
                  <PaymentFlags
                    mismatch={request.amount_mismatch}
                    paidAmount={request.paid_amount_toman}
                    expected={request.amount_toman}
                  />
                </div>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {request.has_receipt ? (
                <ReceiptViewer
                  requestId={request.id}
                  kind="trainer-payment"
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
            <TableCell className="text-muted-foreground">
              {formatPersianDate(parseDate(request.created_at))}
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
                <ReviewActions requestId={request.id} />
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ReviewActions({ requestId }: { requestId: string }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  function close() {
    setMode(null);
    setNote("");
  }

  async function confirm() {
    setBusy(true);
    try {
      if (mode === "approve") {
        await approveTrainerRequest(requestId, note.trim() || undefined);
        toast.success("پرداخت تأیید و اشتراک مربی فعال شد.");
      } else {
        await rejectTrainerRequest(requestId, note.trim() || undefined);
        toast.success("پرداخت رد شد.");
      }
      close();
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    } catch (error) {
      toast.error(getErrorMessage(error, "ثبت تصمیم با خطا مواجه شد."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => setMode("approve")}>
          <Check />
          تایید
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => setMode("reject")}
        >
          <X />
          رد
        </Button>
      </div>
      <Dialog open={mode !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "approve" ? "تایید پرداخت مربی" : "رد پرداخت مربی"}
            </DialogTitle>
            <DialogDescription>
              {mode === "approve"
                ? "اول مطمئن شوید واریزی با این کد پیگیری به حساب شما نشسته است. اشتراک از همین الان شروع یا تمدید می‌شود."
                : "مربی دلیل شما را در اعلان می‌بیند و می‌تواند دوباره پرداخت را ثبت کند."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="trainer-request-note">یادداشت (اختیاری)</Label>
            <Input
              id="trainer-request-note"
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                mode === "approve"
                  ? "مثلاً شمارهٔ تراکنش بانکی"
                  : "دلیل رد درخواست"
              }
            />
          </div>
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
              {mode === "approve" ? "تایید و فعال‌سازی" : "رد درخواست"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
