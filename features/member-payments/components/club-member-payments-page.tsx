"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, ReceiptText, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RoleGate } from "@/features/authentication/components/role-gate";
import { useAuthContext } from "@/features/authentication/hooks/use-auth-context";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import { ReceiptViewer } from "@/features/finance/components/receipt-viewer";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber, formatPersianDate, formatToman } from "@/lib/persian";
import {
  approveMemberPayment,
  listClubMemberPayments,
  rejectMemberPayment,
  type ClubMemberPayment,
  type MemberPaymentStatus,
} from "../services/member-payments-service";

const STATUS_LABEL: Record<MemberPaymentStatus, string> = {
  pending: "در انتظار",
  approved: "تأییدشده",
  rejected: "ردشده",
};
const STATUS_VARIANT: Record<MemberPaymentStatus, "warning" | "success" | "destructive"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
};

const parseDate = (value: string) => new Date(value.replace(" ", "T"));

/** Membership fees athletes say they paid by card: check the receipt, then approve or reject. */
export function ClubMemberPaymentsPage() {
  const { data: context } = useAuthContext();
  const clubId = context?.activeMembership?.clubId ?? "";
  const { data, isLoading, isError } = useQuery({
    queryKey: ["member-payments", "club", clubId],
    queryFn: () => listClubMemberPayments(clubId),
    enabled: clubId.length > 0,
  });
  const [filter, setFilter] = useState<"pending" | "reviewed">("pending");

  const rows = data?.items ?? [];
  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const shown = rows.filter((r) => (filter === "pending" ? r.status === "pending" : r.status !== "pending"));

  return (
    <RoleGate allow={["club"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">پرداخت‌های اعضا</h1>
          <p className="text-sm text-muted-foreground">
            شهریه‌هایی که ورزشکاران با کارت‌به‌کارت پرداخت و ثبت کرده‌اند. بعد از دیدن واریز در حساب
            بانکی، تأیید کنید تا عضویتشان تمدید شود و مبلغ در «درآمد باشگاه» ثبت شود. شمارهٔ کارت
            باشگاه را از «تنظیمات ← دریافت پرداخت» بگذارید.
          </p>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : isError || !data ? (
          <ErrorState message="دریافت پرداخت‌ها با خطا مواجه شد." />
        ) : !data.ready ? (
          <Card className="py-5">
            <p className="px-6 text-sm text-muted-foreground">پرداخت شهریه از سایت هنوز فعال نشده است.</p>
          </Card>
        ) : (
          <Card className="gap-4 py-5">
            <div className="flex gap-2 px-6">
              {(["pending", "reviewed"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    filter === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {value === "pending" ? `در انتظار (${formatNumber(pendingCount)})` : "بررسی‌شده"}
                </button>
              ))}
            </div>
            {shown.length === 0 ? (
              <div className="px-6">
                <EmptyState
                  icon={ReceiptText}
                  title="پرداختی وجود ندارد."
                  description="با ثبت پرداخت توسط ورزشکاران، اینجا نمایش داده می‌شود."
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ورزشکار</TableHead>
                    <TableHead>طرح و مبلغ</TableHead>
                    <TableHead>کد پیگیری</TableHead>
                    <TableHead>رسید</TableHead>
                    <TableHead>تاریخ ثبت</TableHead>
                    <TableHead>وضعیت</TableHead>
                    {filter === "pending" && <TableHead>اقدام</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((payment) => (
                    <PaymentRow key={payment.id} payment={payment} clubId={clubId} showActions={filter === "pending"} />
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        )}
      </div>
    </RoleGate>
  );
}

function PaymentRow({
  payment,
  clubId,
  showActions,
}: {
  payment: ClubMemberPayment;
  clubId: string;
  showActions: boolean;
}) {
  const name = [payment.first_name, payment.last_name].filter(Boolean).join(" ") || "—";

  return (
    <TableRow>
      <TableCell>
        <p className="font-medium text-foreground">{name}</p>
        {payment.phone && (
          <p dir="ltr" className="text-end text-xs text-muted-foreground">
            {payment.phone}
          </p>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {payment.plan_name}
        <p className="text-xs">
          {formatToman(payment.amount_toman)} تومان · {formatNumber(payment.duration_days)} روز
        </p>
        {payment.note && <p className="max-w-48 truncate text-xs">«{payment.note}»</p>}
      </TableCell>
      <TableCell className="text-muted-foreground">
        <div className="space-y-1">
          <p dir="ltr" className="text-end font-mono text-xs text-foreground">
            {payment.tracking_code}
          </p>
          <p className="text-xs">
            کارت ••••{" "}
            <span dir="ltr" className="font-mono">
              {payment.card_last4}
            </span>
          </p>
          {payment.paid_at && <p className="text-xs">واریز: {formatPersianDate(parseDate(payment.paid_at))}</p>}
          {payment.duplicate_tracking && <Badge variant="warning">کد پیگیری تکراری</Badge>}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {payment.has_receipt ? (
          <ReceiptViewer
            requestId={payment.id}
            kind="membership-payment"
            isPdf={payment.receipt_is_pdf}
            expiresAt={payment.receipt_expires_at}
            canDelete
          />
        ) : payment.receipt_purged_at ? (
          <span className="text-xs">حذف شده</span>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{formatPersianDate(parseDate(payment.created_at))}</TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[payment.status]}>{STATUS_LABEL[payment.status]}</Badge>
        {payment.review_note && <p className="mt-1 max-w-40 truncate text-xs text-muted-foreground">{payment.review_note}</p>}
      </TableCell>
      {showActions && (
        <TableCell>
          <ReviewActions payment={payment} clubId={clubId} />
        </TableCell>
      )}
    </TableRow>
  );
}

function ReviewActions({ payment, clubId }: { payment: ClubMemberPayment; clubId: string }) {
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
        await approveMemberPayment(payment.id, note.trim() || undefined);
        toast.success("پرداخت تأیید و عضویت تمدید شد.");
      } else {
        await rejectMemberPayment(payment.id, note.trim() || undefined);
        toast.success("پرداخت رد شد و به ورزشکار اطلاع داده شد.");
      }
      close();
      void queryClient.invalidateQueries({ queryKey: ["member-payments", "club", clubId] });
      // A member's expiry changed, and the club's revenue gained an entry.
      void queryClient.invalidateQueries({ queryKey: ["club-members"] });
      void queryClient.invalidateQueries({ queryKey: ["club-revenue"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
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
        <Button size="sm" variant="destructive" onClick={() => setMode("reject")}>
          <X />
          رد
        </Button>
      </div>
      <Dialog open={mode !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "approve" ? "تأیید پرداخت شهریه" : "رد پرداخت شهریه"}</DialogTitle>
            <DialogDescription>
              {mode === "approve"
                ? `اول مطمئن شوید ${formatToman(payment.amount_toman)} تومان با این کد پیگیری به حساب باشگاه نشسته است. عضویت ${formatNumber(payment.duration_days)} روز تمدید می‌شود (از انقضای فعلی، یا از امروز اگر تمام شده)، و مبلغ در درآمد باشگاه ثبت می‌شود.`
                : "ورزشکار دلیل شما را در اعلان می‌بیند و می‌تواند دوباره پرداخت را ثبت کند."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="member-payment-note">یادداشت (اختیاری)</Label>
            <Input
              id="member-payment-note"
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={mode === "approve" ? "یادداشت داخلی" : "مثلاً: واریزی با این کد به حساب من نرسیده است."}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>
              انصراف
            </Button>
            <Button variant={mode === "reject" ? "destructive" : "default"} onClick={confirm} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {mode === "approve" ? "تایید و تمدید" : "رد پرداخت"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
