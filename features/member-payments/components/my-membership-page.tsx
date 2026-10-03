"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Loader2, Paperclip, Wallet, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SubscriptionStatusBadge } from "@/features/admin/components/subscription-status-badge";
import { RoleGate } from "@/features/authentication/components/role-gate";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import { CancelRequestButton } from "@/features/finance/components/cancel-request-button";
import { AmountToPay, PaidAmountField, parsePaidAmount } from "@/features/finance/components/payment-form-bits";
import { PaymentInfoCard } from "@/features/finance/components/payment-info-card";
import { ReceiptViewer } from "@/features/finance/components/receipt-viewer";
import { prepareReceipt, type DiscountQuote } from "@/features/finance/services/finance-service";
import { todayIso } from "@/lib/iso-date";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber, formatPersianDate, formatToman, toAsciiDigits } from "@/lib/persian";
import {
  cancelMemberPayment,
  checkMemberDiscount,
  getMyMembershipPayments,
  submitMemberPayment,
  type MemberPaymentStatus,
  type MembershipPlanOption,
  type MyClubMembership,
} from "../services/member-payments-service";
import type { ReceiptRules } from "@/features/finance/services/finance-service";

const QUERY_KEY = ["member-payments", "mine"] as const;

const STATUS_LABEL: Record<MemberPaymentStatus, string> = {
  pending: "در انتظار تأیید",
  approved: "تأییدشده",
  rejected: "ردشده",
};
const STATUS_VARIANT: Record<MemberPaymentStatus, "warning" | "success" | "destructive"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
};

const parseDate = (value: string) => new Date(value.replace(" ", "T"));

/** The athlete's membership in each club they belong to, and paying the fee card-to-card. */
export function MyMembershipPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: QUERY_KEY, queryFn: getMyMembershipPayments });

  return (
    <RoleGate allow={["athlete"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">عضویت من</h1>
          <p className="text-sm text-muted-foreground">
            وضعیت عضویت شما در باشگاه، و پرداخت یا تمدید شهریه به‌صورت کارت‌به‌کارت.
          </p>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : isError || !data ? (
          <ErrorState message="دریافت اطلاعات عضویت با خطا مواجه شد." />
        ) : !data.ready ? (
          <Card className="py-5">
            <p className="px-6 text-sm text-muted-foreground">پرداخت شهریه از سایت هنوز فعال نشده است.</p>
          </Card>
        ) : (data.clubs ?? []).length === 0 ? (
          <Card className="py-8">
            <div className="px-6">
              <EmptyState
                icon={Wallet}
                title="عضو هیچ باشگاهی نیستید."
                description="وقتی باشگاهی شما را عضو کند، وضعیت عضویت و پرداخت شهریه اینجا دیده می‌شود."
              />
            </div>
          </Card>
        ) : (
          (data.clubs ?? []).map((club) => (
            <ClubSection
              key={club.membership_id}
              club={club}
              rules={data.receipts}
              discountsEnabled={data.discounts_enabled === true}
            />
          ))
        )}
      </div>
    </RoleGate>
  );
}

function ClubSection({
  club,
  rules,
  discountsEnabled,
}: {
  club: MyClubMembership;
  rules?: ReceiptRules;
  discountsEnabled: boolean;
}) {
  const waiting = club.requests.some((request) => request.status === "pending");
  const lastRejected = !waiting && club.requests[0]?.status === "rejected" ? club.requests[0] : null;
  const hasAccount = !!club.pay_to && (club.pay_to.card_number || club.pay_to.sheba);

  return (
    <>
      <Card className="gap-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2 px-6">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4" />
            {club.club_name}
          </CardTitle>
          {club.expires_at ? (
            <SubscriptionStatusBadge status={club.status} />
          ) : (
            <Badge variant="secondary">بدون تاریخ انقضا</Badge>
          )}
        </div>
        <div className="space-y-1 px-6 text-sm text-muted-foreground">
          <p>
            طرح فعلی: <span className="font-medium text-foreground">{club.plan_name ?? "—"}</span>
          </p>
          {club.expires_at && (
            <p>
              {club.status === "expired" ? "عضویت شما در تاریخ " : "عضویت شما تا "}
              <span className="font-medium text-foreground">
                {formatPersianDate(new Date(`${club.expires_at}T00:00:00`))}
              </span>
              {club.status === "expired"
                ? " تمام شده است."
                : ` (${formatNumber(club.remaining_days ?? 0)} روز مانده) اعتبار دارد.`}
            </p>
          )}
          {club.status && club.status !== "active" && (
            <p className="font-medium text-warning">برای تمدید، یکی از طرح‌های زیر را انتخاب و پرداخت کنید.</p>
          )}
        </div>
      </Card>

      <Card className="gap-4 py-5">
        <div className="space-y-1 px-6">
          <CardTitle className="text-base">طرح‌های عضویت</CardTitle>
          <CardDescription>
            طرح را انتخاب و به کارت باشگاه واریز کنید، بعد کد پیگیری و رسید را ثبت کنید. بعد از تأیید
            باشگاه، عضویت‌تان تمدید می‌شود و روزهای باقی‌ماندهٔ قبلی از دست نمی‌رود.
          </CardDescription>
        </div>
        {!hasAccount && (
          <p className="px-6 text-xs text-muted-foreground">
            باشگاه هنوز شمارهٔ کارت خود را در سایت ثبت نکرده است؛ روش پرداخت را از خود باشگاه بپرسید.
          </p>
        )}
        {club.plans.length === 0 ? (
          <p className="px-6 text-sm text-muted-foreground">این باشگاه هنوز طرح پولی تعریف نکرده است.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 px-6 sm:grid-cols-2 lg:grid-cols-3">
            {club.plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                club={club}
                rules={rules}
                disabled={waiting}
                discountsEnabled={discountsEnabled}
              />
            ))}
          </div>
        )}
        {waiting && (
          <p className="px-6 text-xs text-muted-foreground">
            پرداخت قبلی شما در انتظار تأیید باشگاه است؛ بعد از نتیجه می‌توانید پرداخت تازه ثبت کنید.
          </p>
        )}
        {lastRejected && (
          <p className="px-6 text-xs text-destructive">
            پرداخت قبلی تأیید نشد: {lastRejected.review_note ?? "برای پیگیری با باشگاه صحبت کنید."}
          </p>
        )}
      </Card>

      <Card className="gap-4 py-5">
        <div className="px-6">
          <CardTitle className="text-base">تاریخچهٔ پرداخت‌ها</CardTitle>
        </div>
        {club.requests.length === 0 ? (
          <p className="px-6 text-sm text-muted-foreground">هنوز پرداختی ثبت نکرده‌اید.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>طرح</TableHead>
                <TableHead>مبلغ</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead>کد پیگیری</TableHead>
                <TableHead>یادداشت باشگاه</TableHead>
                <TableHead>تاریخ ثبت</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {club.requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="text-foreground">{request.plan_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatToman(request.amount_toman)} تومان
                    {!!request.discount_toman && request.discount_toman > 0 && (
                      <p className="text-xs">
                        با کد <span dir="ltr" className="font-mono">{request.discount_code}</span>،{" "}
                        {formatToman(request.discount_toman)} تومان تخفیف
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[request.status]}>{STATUS_LABEL[request.status]}</Badge>
                    {request.status === "pending" && (
                      <div className="pt-2">
                        <CancelRequestButton
                          onCancel={() => cancelMemberPayment(request.id)}
                          queryKeys={[QUERY_KEY]}
                        />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="space-y-1">
                      <p dir="ltr" className="text-end font-mono text-xs text-foreground">
                        {request.tracking_code}
                      </p>
                      {request.has_receipt && (
                        <ReceiptViewer
                          requestId={request.id}
                          kind="membership-payment"
                          isPdf={request.receipt_is_pdf}
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{request.review_note ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatPersianDate(parseDate(request.created_at))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}

function PlanCard({
  plan,
  club,
  rules,
  disabled,
  discountsEnabled,
}: {
  plan: MembershipPlanOption;
  club: MyClubMembership;
  rules?: ReceiptRules;
  disabled: boolean;
  discountsEnabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = club.plan_name === plan.name && club.status !== "expired";

  return (
    <div className="flex flex-col justify-between gap-3 rounded-xl border border-border p-4">
      <div className="space-y-1">
        <p className="font-medium text-foreground">{plan.name}</p>
        <p className="text-lg font-bold text-foreground">{formatToman(plan.price_toman)} تومان</p>
        <p className="text-xs text-muted-foreground">{formatNumber(plan.duration_days)} روز</p>
        {plan.description && <p className="text-xs leading-5 text-muted-foreground">{plan.description}</p>}
      </div>
      <Button size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        {current ? "تمدید" : "پرداخت"}
      </Button>
      <PayDialog
        plan={plan}
        club={club}
        rules={rules}
        discountsEnabled={discountsEnabled}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}

function PayDialog({
  plan,
  club,
  rules,
  discountsEnabled,
  open,
  onOpenChange,
}: {
  plan: MembershipPlanOption;
  club: MyClubMembership;
  rules?: ReceiptRules;
  discountsEnabled: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [trackingCode, setTrackingCode] = useState("");
  const [cardLast4, setCardLast4] = useState("");
  const [paidAt, setPaidAt] = useState(todayIso());
  const [paidAmount, setPaidAmount] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [discountText, setDiscountText] = useState("");
  const [quote, setQuote] = useState<DiscountQuote | null>(null);
  const [checking, setChecking] = useState(false);
  const price = quote ? quote.final_toman : plan.price_toman;

  async function applyCode() {
    if (!discountText.trim()) return;
    setChecking(true);
    try {
      setQuote(await checkMemberDiscount(plan.id, discountText.trim()));
      setError(null);
      toast.success("کد تخفیف اعمال شد.");
    } catch (e) {
      setQuote(null);
      toast.error(getErrorMessage(e, "بررسی کد تخفیف ناموفق بود."));
    } finally {
      setChecking(false);
    }
  }

  async function submit() {
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
    setSaving(true);
    try {
      const prepared = receipt ? await prepareReceipt(receipt) : null;
      if (prepared && rules && prepared.size > rules.max_mb * 1024 * 1024) {
        setError(`حجم رسید باید حداکثر ${rules.max_mb} مگابایت باشد.`);
        return;
      }
      await submitMemberPayment({
        planId: plan.id,
        trackingCode: code,
        cardLast4: last4,
        paidAt: paidAt || undefined,
        paidAmount: parsePaidAmount(paidAmount ?? String(price)) ?? undefined,
        note: note.trim() || undefined,
        discountCode: quote?.code,
        receipt: prepared,
      });
      toast.success("پرداخت شما ثبت شد و در انتظار تأیید باشگاه است.");
      setTrackingCode("");
      setCardLast4("");
      setPaidAt(todayIso());
      setPaidAmount(null);
      setNote("");
      setReceipt(null);
      setDiscountText("");
      setQuote(null);
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    } catch (e) {
      setError(getErrorMessage(e, "ثبت پرداخت با خطا مواجه شد."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            پرداخت طرح «{plan.name}» · {club.club_name}
          </DialogTitle>
          <DialogDescription>
            مبلغ {formatToman(price)} تومان را به کارت زیر واریز کنید و بعد اطلاعات پرداخت را ثبت کنید.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {discountsEnabled && (
            <div className="space-y-2">
              <Label htmlFor="mp-discount">
                کد تخفیف <span className="text-muted-foreground">(اگر دارید)</span>
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
                    <span className="line-through">{formatToman(quote.list_price_toman)}</span> ←{" "}
                    <span className="font-medium text-foreground">{formatToman(quote.final_toman)} تومان</span>{" "}
                    ({formatToman(quote.discount_toman)} تومان تخفیف)
                  </p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    id="mp-discount"
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

          <PaymentInfoCard
            info={
              club.pay_to
                ? {
                    card_number: club.pay_to.card_number,
                    sheba: club.pay_to.sheba,
                    account_holder: club.pay_to.holder_name,
                    bank_name: club.pay_to.bank_name,
                    instructions: "",
                  }
                : null
            }
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mp-tracking">کد پیگیری واریز</Label>
              <Input
                id="mp-tracking"
                dir="ltr"
                maxLength={40}
                autoComplete="off"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mp-last4">چهار رقم آخر کارت شما</Label>
              <Input
                id="mp-last4"
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
            <Label htmlFor="mp-receipt">
              تصویر رسید{" "}
              <span className="text-muted-foreground">{rules?.required === false ? "(اختیاری)" : "(الزامی)"}</span>
            </Label>
            <label
              htmlFor="mp-receipt"
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-input px-4 py-3 text-sm text-muted-foreground hover:bg-accent"
            >
              <Paperclip className="size-4 shrink-0" />
              <span className="truncate">{receipt ? receipt.name : "انتخاب عکس یا فایل PDF"}</span>
            </label>
            <input
              id="mp-receipt"
              type="file"
              accept="image/*,application/pdf"
              className="sr-only"
              onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
            />
            {rules && (
              <p className="text-xs text-muted-foreground">
                عکس قبل از ارسال کوچک می‌شود. حداکثر {rules.max_mb} مگابایت
                {rules.retention_days > 0 ? `؛ فایل ${rules.retention_days} روز پس از بررسی حذف می‌شود.` : "."}
              </p>
            )}
          </div>

          <PaidAmountField
            id="mp-paid-amount"
            value={paidAmount ?? String(price)}
            onChange={setPaidAmount}
            expected={price}
          />

          <JalaliDateField id="mp-paid-at" label="تاریخ واریز" value={paidAt} onChange={setPaidAt} />

          <div className="space-y-2">
            <Label htmlFor="mp-note">
              توضیح برای باشگاه <span className="text-muted-foreground">(اختیاری)</span>
            </Label>
            <Input id="mp-note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            ثبت پرداخت
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
