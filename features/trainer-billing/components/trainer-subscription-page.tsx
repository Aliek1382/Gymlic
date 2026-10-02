"use client";

import { useState } from "react";
import Link from "next/link";
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
import {
  hasPaymentInfo,
  PaymentInfoCard,
  PaymentInfoMissing,
} from "@/features/finance/components/payment-info-card";
import { ReceiptViewer } from "@/features/finance/components/receipt-viewer";
import { prepareReceipt, type DiscountQuote } from "@/features/finance/services/finance-service";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber, formatPersianDate, formatToman, toAsciiDigits } from "@/lib/persian";
import { MyTierBadge } from "@/features/site-settings/components/my-tier-badge";
import {
  checkTrainerDiscount,
  getTrainerBilling,
  submitTrainerPayment,
  type TrainerBillingOverview,
  type TrainerPlan,
  type TrainerRequestStatus,
} from "../services/trainer-billing-service";
import { PlanGraceBanner } from "./plan-grace-banner";

const QUERY_KEY = ["trainer-billing"] as const;

const STATUS_LABEL: Record<TrainerRequestStatus, string> = {
  pending: "در انتظار بررسی",
  approved: "تأییدشده",
  rejected: "ردشده",
};
const STATUS_VARIANT: Record<TrainerRequestStatus, "warning" | "success" | "destructive"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
};

const parseDate = (value: string) => new Date(value.replace(" ", "T"));

/** The trainer's own platform subscription: status, plans to buy, and payment history. */
export function TrainerSubscriptionPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: QUERY_KEY, queryFn: getTrainerBilling });

  return (
    <RoleGate allow={["trainer"]}>
      <div className="space-y-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">اشتراک من</h1>
            <MyTierBadge />
          </div>
          <p className="text-sm text-muted-foreground">
            اشتراک شما در جیم‌لیک، پلن‌ها و تاریخچهٔ پرداخت‌های کارت‌به‌کارت.
          </p>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : isError || !data ? (
          <ErrorState message="دریافت اطلاعات اشتراک با خطا مواجه شد." />
        ) : !data.ready ? (
          <Card className="py-5">
            <p className="px-6 text-sm text-muted-foreground">
              پرداخت اشتراک مربی هنوز فعال نشده است.
            </p>
          </Card>
        ) : (
          <Content data={data} />
        )}
      </div>
    </RoleGate>
  );
}

function Content({ data }: { data: TrainerBillingOverview }) {
  const requests = data.requests ?? [];
  const plans = data.plans ?? [];
  const waiting = requests.some((request) => request.status === "pending");

  return (
    <>
      {data.limits?.ready ? <PlanStatusCard data={data} /> : <LegacyStatusCard data={data} />}

      {!data.in_club && (
        <Card className="gap-4 py-5">
          <div className="space-y-1 px-6">
            <CardTitle className="text-base">پلن‌ها</CardTitle>
            <CardDescription>
              پلن را انتخاب و به کارت پلتفرم واریز کنید، بعد کد پیگیری و رسید را ثبت کنید. بعد از
              تأیید مدیریت، تمدید همان پلن به روزهای باقی‌ماندهٔ قبلی اضافه می‌شود؛ پلن دیگری از همان
              روز تأیید با مدت کامل شروع می‌شود.
            </CardDescription>
          </div>
          {plans.length === 0 ? (
            <p className="px-6 text-sm text-muted-foreground">هنوز پلنی تعریف نشده است.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 px-6 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} data={data} disabled={waiting} />
              ))}
            </div>
          )}
          {waiting && (
            <p className="px-6 text-xs text-muted-foreground">
              پرداخت قبلی شما در انتظار بررسی است؛ بعد از نتیجه می‌توانید پرداخت تازه ثبت کنید.
            </p>
          )}
        </Card>
      )}

      <Card className="gap-4 py-5">
        <div className="px-6">
          <CardTitle className="text-base">تاریخچهٔ پرداخت‌ها</CardTitle>
        </div>
        {requests.length === 0 ? (
          <div className="px-6">
            <EmptyState
              icon={Wallet}
              title="هنوز پرداختی ثبت نکرده‌اید."
              description="بعد از ثبت پرداخت، وضعیت بررسی آن اینجا دیده می‌شود."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>پلن</TableHead>
                <TableHead>مبلغ</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead>کد پیگیری</TableHead>
                <TableHead>یادداشت مدیریت</TableHead>
                <TableHead>تاریخ ثبت</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
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
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="space-y-1">
                      <p dir="ltr" className="text-end font-mono text-xs text-foreground">
                        {request.tracking_code === "DISCOUNT" ? "—" : request.tracking_code}
                      </p>
                      {request.has_receipt && (
                        <ReceiptViewer
                          requestId={request.id}
                          kind="trainer-payment"
                          isPdf={request.receipt_is_pdf}
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{request.admin_note ?? "—"}</TableCell>
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

/** The plan in effect (Limits): free or paid, its dates, and how much of it is used. */
function PlanStatusCard({ data }: { data: TrainerBillingOverview }) {
  const limits = data.limits!;
  const subscription = limits.subscription;
  const used = limits.usage.active + limits.usage.pending_invites;
  const paid = subscription !== null && !subscription.is_free;

  return (
    <>
      <PlanGraceBanner limits={limits} />
      <Card className="gap-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2 px-6">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4" />
            پلن فعلی: {limits.plan.name ?? "—"}
          </CardTitle>
          <div className="flex items-center gap-2">
            {limits.override && <Badge variant="info">سقف ویژه از طرف مدیریت</Badge>}
            {limits.plan.is_free ? <Badge variant="secondary">رایگان</Badge> : <SubscriptionStatusBadge status={limits.status} />}
          </div>
        </div>
        <div className="space-y-1 px-6 text-sm text-muted-foreground">
          {paid && subscription.expires_at && limits.status !== "expired" && (
            <p>
              از {formatPersianDate(parseDate(subscription.started_at))} تا{" "}
              <span className="font-medium text-foreground">{formatPersianDate(parseDate(subscription.expires_at))}</span>
              {subscription.remaining_days ? ` (${formatNumber(subscription.remaining_days)} روز مانده)` : ""}
            </p>
          )}
          {limits.plan.is_free && <p>پلن رایگان محدودیت زمانی ندارد. برای ورزشکار بیشتر، یکی از پلن‌های زیر را تهیه کنید.</p>}
          <p>
            ورزشکاران: <span className="font-medium text-foreground">{formatNumber(used)}</span>
            {limits.max_athletes != null ? ` از ${formatNumber(limits.max_athletes)}` : " (بدون سقف)"}
            {limits.usage.pending_invites > 0 && ` · شامل ${formatNumber(limits.usage.pending_invites)} دعوت در انتظار`}
          </p>
          {limits.usage.suspended > 0 && (
            <p className="text-warning">
              {formatNumber(limits.usage.suspended)} ورزشکار به‌خاطر پایان اشتراک غیرفعال است؛ اطلاعاتشان باقی است و با تمدید برمی‌گردند.
            </p>
          )}
          {limits.club && (
            <p>
              ورزشکارانی که از طرف باشگاه «{limits.club.name}» دعوت می‌کنید، تابع پلن باشگاه هستند و از این سقف کم نمی‌کنند.
            </p>
          )}
          {!limits.enforcing && <p>در حال حاضر محدودیت پلن‌ها اعمال نمی‌شود؛ هر زمان لازم شد، قبلش خبر می‌دهیم.</p>}
        </div>
        {paid && (limits.usage.active + limits.usage.suspended > (limits.free_max_athletes ?? Infinity)) && (
          <div className="px-6">
            <Button size="sm" variant="outline" asChild>
              <Link href="/subscription/athletes">انتخاب ورزشکارانی که بعد از پایان اشتراک فعال می‌مانند</Link>
            </Button>
          </div>
        )}
        {!paid && limits.usage.suspended > 0 && (
          <div className="px-6">
            <Button size="sm" variant="outline" asChild>
              <Link href="/subscription/athletes">انتخاب ورزشکاران فعال</Link>
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}

/** Before the plan-limits database update: the subscription as it was shown until now. */
function LegacyStatusCard({ data }: { data: TrainerBillingOverview }) {
  const subscription = data.subscription ?? null;
  const athletes = data.athletes ?? { active: 0, pending_invites: 0 };
  const used = athletes.active + athletes.pending_invites;

  return (
    <Card className="gap-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-2 px-6">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="size-4" />
          وضعیت اشتراک
        </CardTitle>
        <SubscriptionStatusBadge status={subscription?.status ?? null} />
      </div>
      <div className="space-y-1 px-6 text-sm text-muted-foreground">
        {data.in_club ? (
          <p>شما عضو یک باشگاه هستید و از اشتراک باشگاه استفاده می‌کنید؛ نیازی به پرداخت جداگانه نیست.</p>
        ) : subscription?.expires_at ? (
          <>
            <p>
              پلن <span className="font-medium text-foreground">{subscription.plan_name}</span>
              {subscription.status === "expired" ? " در تاریخ " : " تا "}
              <span className="font-medium text-foreground">{formatPersianDate(parseDate(subscription.expires_at))}</span>
              {subscription.status === "expired"
                ? " تمام شده است."
                : ` (${formatNumber(subscription.remaining_days ?? 0)} روز مانده) فعال است.`}
            </p>
            <p>
              ورزشکاران: {formatNumber(used)}
              {subscription.max_athletes != null ? ` از ${formatNumber(subscription.max_athletes)}` : " (بدون سقف)"}
            </p>
          </>
        ) : (
          <p>هنوز اشتراکی ندارید.</p>
        )}
        {!data.in_club &&
          (data.enforcing ? (
            <p>برای دعوت ورزشکار تازه، اشتراک فعال و ظرفیت آزاد لازم است. ورزشکاران فعلی‌تان همیشه می‌مانند.</p>
          ) : (
            <p>در حال حاضر داشتن اشتراک الزامی نیست؛ هر زمان لازم شد، قبلش خبر می‌دهیم.</p>
          ))}
      </div>
    </Card>
  );
}

const REPORT_LABEL: Record<string, string> = {
  count: "گزارش تعداد",
  basic: "گزارش پایه",
  full: "گزارش کامل",
  full_excel: "گزارش کامل + خروجی Excel",
};

/** "Unlimited" for null, else the number with its unit. */
const cap = (value: number | null | undefined, unit: string) =>
  value == null ? `${unit} نامحدود` : `${formatNumber(value)} ${unit}`;

function PlanCard({
  plan,
  data,
  disabled,
}: {
  plan: TrainerPlan;
  data: TrainerBillingOverview;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = data.limits?.ready
    ? data.limits.plan.id === plan.id && data.limits.status !== "expired"
    : data.subscription?.plan_name === plan.name && data.subscription.status !== "expired";

  return (
    <div className="flex flex-col justify-between gap-3 rounded-xl border border-border p-4">
      <div className="space-y-1">
        <p className="font-medium text-foreground">{plan.name}</p>
        <p className="text-lg font-bold text-foreground">{formatToman(plan.price_toman)} تومان</p>
        <p className="text-xs text-muted-foreground">
          {formatNumber(plan.duration_days)} روز ·{" "}
          {plan.max_athletes != null ? `تا ${formatNumber(plan.max_athletes)} ورزشکار` : "ورزشکار نامحدود"}
        </p>
        {plan.report_level !== undefined && (
          <ul className="space-y-0.5 pt-1 text-xs text-muted-foreground">
            <li>{cap(plan.max_custom_exercises, "حرکت سفارشی")}</li>
            <li>{cap(plan.max_templates, "قالب برنامه")}</li>
            <li>{plan.history_months == null ? "تاریخچهٔ کامل" : `تاریخچهٔ ${formatNumber(plan.history_months)} ماه اخیر`}</li>
            {plan.report_level && <li>{REPORT_LABEL[plan.report_level]}</li>}
          </ul>
        )}
      </div>
      <Button size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        {current ? "تمدید" : "خرید"}
      </Button>
      <PaymentDialog plan={plan} data={data} open={open} onOpenChange={setOpen} />
    </div>
  );
}

function PaymentDialog({
  plan,
  data,
  open,
  onOpenChange,
}: {
  plan: TrainerPlan;
  data: TrainerBillingOverview;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const rules = data.receipts;
  const [trackingCode, setTrackingCode] = useState("");
  const [cardLast4, setCardLast4] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [discountText, setDiscountText] = useState("");
  const [quote, setQuote] = useState<DiscountQuote | null>(null);
  const [checking, setChecking] = useState(false);

  // A code that covers the whole price leaves nothing to pay: no card, code or receipt.
  const free = quote !== null && quote.final_toman === 0;
  const price = quote ? quote.final_toman : plan.price_toman;

  async function applyCode() {
    if (!discountText.trim()) return;
    setChecking(true);
    try {
      setQuote(await checkTrainerDiscount(plan.id, discountText.trim()));
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
    if (!free) {
      if (!/^[A-Za-z0-9_/-]{4,40}$/.test(code)) {
        setError("کد پیگیری باید بین ۴ تا ۴۰ حرف یا رقم باشد.");
        return;
      }
      if (!/^\d{4}$/.test(last4)) {
        setError("چهار رقم آخر کارت خود را وارد کنید.");
        return;
      }
      if (rules?.required !== false && !receipt) {
        setError("تصویر یا فایل رسید پرداخت را پیوست کنید.");
        return;
      }
    }
    setError(null);
    setSaving(true);
    try {
      const prepared = !free && receipt ? await prepareReceipt(receipt) : null;
      if (prepared && rules && prepared.size > rules.max_mb * 1024 * 1024) {
        setError(`حجم رسید باید حداکثر ${rules.max_mb} مگابایت باشد.`);
        return;
      }
      await submitTrainerPayment({
        planId: plan.id,
        trackingCode: free ? undefined : code,
        cardLast4: free ? undefined : last4,
        paidAt: free ? undefined : paidAt || undefined,
        note: note.trim() || undefined,
        discountCode: quote?.code,
        receipt: prepared,
      });
      toast.success("پرداخت شما ثبت شد و در انتظار تأیید مدیریت است.");
      setTrackingCode("");
      setCardLast4("");
      setPaidAt("");
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
          <DialogTitle>ثبت پرداخت پلن «{plan.name}»</DialogTitle>
          <DialogDescription>
            {free
              ? "با این کد تخفیف چیزی برای پرداخت نمی‌ماند؛ درخواست را ثبت کنید تا مدیریت تأیید کند."
              : `مبلغ ${formatToman(price)} تومان را به کارت زیر واریز کنید و بعد اطلاعات پرداخت را ثبت کنید.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {data.discounts_enabled && (
            <div className="space-y-2">
              <Label htmlFor="tb-discount">
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
                    id="tb-discount"
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

          {!free && (hasPaymentInfo(data.payment) ? <PaymentInfoCard info={data.payment} /> : <PaymentInfoMissing />)}

          {!free && (
          <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tb-tracking">کد پیگیری واریز</Label>
              <Input
                id="tb-tracking"
                dir="ltr"
                maxLength={40}
                autoComplete="off"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tb-last4">چهار رقم آخر کارت شما</Label>
              <Input
                id="tb-last4"
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
            <Label htmlFor="tb-receipt">
              تصویر رسید{" "}
              <span className="text-muted-foreground">{rules?.required === false ? "(اختیاری)" : "(الزامی)"}</span>
            </Label>
            <label
              htmlFor="tb-receipt"
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-input px-4 py-3 text-sm text-muted-foreground hover:bg-accent"
            >
              <Paperclip className="size-4 shrink-0" />
              <span className="truncate">{receipt ? receipt.name : "انتخاب عکس یا فایل PDF"}</span>
            </label>
            <input
              id="tb-receipt"
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

          <div className="space-y-2">
            <Label htmlFor="tb-paid-at">
              زمان واریز <span className="text-muted-foreground">(اختیاری)</span>
            </Label>
            <Input
              id="tb-paid-at"
              type="datetime-local"
              dir="ltr"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </div>
          </>
          )}

          <div className="space-y-2">
            <Label htmlFor="tb-note">
              توضیح <span className="text-muted-foreground">(اختیاری)</span>
            </Label>
            <Input id="tb-note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {free ? "ثبت درخواست" : "ثبت پرداخت"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
