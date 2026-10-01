"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Loader2, Paperclip, Wallet } from "lucide-react";
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
import { PaymentInfoCard } from "@/features/finance/components/payment-info-card";
import { ReceiptViewer } from "@/features/finance/components/receipt-viewer";
import { prepareReceipt } from "@/features/finance/services/finance-service";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber, formatPersianDate, formatToman, toAsciiDigits } from "@/lib/persian";
import {
  getTrainerBilling,
  submitTrainerPayment,
  type TrainerBillingOverview,
  type TrainerPlan,
  type TrainerRequestStatus,
} from "../services/trainer-billing-service";

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
          <h1 className="text-xl font-bold text-foreground">اشتراک من</h1>
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
  const subscription = data.subscription ?? null;
  const requests = data.requests ?? [];
  const plans = data.plans ?? [];
  const waiting = requests.some((request) => request.status === "pending");
  const athletes = data.athletes ?? { active: 0, pending_invites: 0 };
  const used = athletes.active + athletes.pending_invites;

  return (
    <>
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
          ) : subscription ? (
            <>
              <p>
                پلن <span className="font-medium text-foreground">{subscription.plan_name}</span>
                {subscription.status === "expired" ? " در تاریخ " : " تا "}
                <span className="font-medium text-foreground">
                  {formatPersianDate(parseDate(subscription.expires_at))}
                </span>
                {subscription.status === "expired"
                  ? " تمام شده است."
                  : ` (${formatNumber(subscription.remaining_days)} روز مانده) فعال است.`}
              </p>
              <p>
                ورزشکاران: {formatNumber(used)}
                {subscription.max_athletes != null
                  ? ` از ${formatNumber(subscription.max_athletes)}`
                  : " (بدون سقف)"}
                {athletes.pending_invites > 0 && ` · شامل ${formatNumber(athletes.pending_invites)} دعوت در انتظار`}
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

      {!data.in_club && (
        <Card className="gap-4 py-5">
          <div className="space-y-1 px-6">
            <CardTitle className="text-base">پلن‌ها</CardTitle>
            <CardDescription>
              پلن را انتخاب و به کارت پلتفرم واریز کنید، بعد کد پیگیری و رسید را ثبت کنید. بعد از
              تأیید مدیریت، اشتراک فعال یا تمدید می‌شود و روزهای باقی‌ماندهٔ قبلی از دست نمی‌رود.
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
                  <TableCell className="text-muted-foreground">{formatToman(request.amount_toman)} تومان</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[request.status]}>{STATUS_LABEL[request.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="space-y-1">
                      <p dir="ltr" className="text-end font-mono text-xs text-foreground">
                        {request.tracking_code}
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
  const current = data.subscription?.plan_name === plan.name && data.subscription.status !== "expired";

  return (
    <div className="flex flex-col justify-between gap-3 rounded-xl border border-border p-4">
      <div className="space-y-1">
        <p className="font-medium text-foreground">{plan.name}</p>
        <p className="text-lg font-bold text-foreground">{formatToman(plan.price_toman)} تومان</p>
        <p className="text-xs text-muted-foreground">
          {formatNumber(plan.duration_days)} روز ·{" "}
          {plan.max_athletes != null ? `تا ${formatNumber(plan.max_athletes)} ورزشکار` : "ورزشکار نامحدود"}
        </p>
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
      await submitTrainerPayment({
        planId: plan.id,
        trackingCode: code,
        cardLast4: last4,
        paidAt: paidAt || undefined,
        note: note.trim() || undefined,
        receipt: prepared,
      });
      toast.success("پرداخت شما ثبت شد و در انتظار تأیید مدیریت است.");
      setTrackingCode("");
      setCardLast4("");
      setPaidAt("");
      setNote("");
      setReceipt(null);
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
            مبلغ {formatToman(plan.price_toman)} تومان را به کارت زیر واریز کنید و بعد اطلاعات پرداخت را ثبت کنید.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <PaymentInfoCard info={data.payment} />

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
            ثبت پرداخت
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
