"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Gift, Loader2, ReceiptText, Tags, UserCheck, X } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import { ReceiptViewer } from "@/features/finance/components/receipt-viewer";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber, formatPersianDate, formatToman, toAsciiDigits } from "@/lib/persian";
import {
  approveTrainerRequest,
  createTrainerDiscount,
  deleteTrainerDiscount,
  grantTrainerDays,
  listTrainerDiscounts,
  updateTrainerDiscount,
  listAdminTrainerPlans,
  listTrainerRequests,
  listTrainerSubscriptions,
  rejectTrainerRequest,
  updateTrainerPlan,
  type AdminTrainerRequest,
  type AdminTrainerSubscriptionRow,
  type TrainerPlan,
  type TrainerRequestStatus,
} from "../services/trainer-billing-service";
import { DiscountCodesManager } from "@/features/admin/components/discount-codes-manager";
import { SubscriptionStatusBadge } from "@/features/admin/components/subscription-status-badge";
import { TrainerPlanDialog } from "./trainer-plan-dialog";

const DISCOUNT_CONFIG = {
  queryKey: ["admin", "trainer-discounts"],
  load: listTrainerDiscounts,
  create: createTrainerDiscount,
  update: updateTrainerDiscount,
  remove: deleteTrainerDiscount,
  onceLabel: "هر مربی فقط یک بار",
  onceBadge: "یک بار برای هر مربی",
  notReady: "به‌روزرسانی «کد تخفیف و یادآور پایان اشتراک مربی» را از صفحهٔ «به‌روزرسانی دیتابیس» اجرا کنید.",
  emptyText: "با «کد جدید» اولین کد را بسازید.",
};

const STATUS_LABEL: Record<TrainerRequestStatus, string> = {
  pending: "در انتظار",
  approved: "تاییدشده",
  rejected: "ردشده",
};
const STATUS_VARIANT: Record<TrainerRequestStatus, "warning" | "success" | "destructive"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
};

const parseDate = (value: string) => new Date(value.replace(" ", "T"));
const fullName = (first: string | null, last: string | null) =>
  [first, last].filter(Boolean).join(" ") || "—";

/** Everything the admin does about trainer subscriptions: payments, plans, and who has what. */
export function AdminTrainerBillingPage() {
  const requests = useQuery({ queryKey: ["admin", "trainer-requests"], queryFn: listTrainerRequests });
  const pendingCount = (requests.data?.items ?? []).filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">اشتراک مربیان</h1>
        <p className="text-sm text-muted-foreground">
          پرداخت‌های کارت‌به‌کارت مربیان، پلن‌های مخصوص مربی و وضعیت اشتراک هر مربی. کارت دریافت از
          «اطلاعات پرداخت» می‌آید و همان کارت باشگاه‌هاست.
        </p>
      </div>

      {requests.isLoading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : requests.isError ? (
        <ErrorState message="دریافت اطلاعات با خطا مواجه شد." />
      ) : requests.data && !requests.data.ready ? (
        <Card className="py-5">
          <p className="px-6 text-sm text-muted-foreground">
            اشتراک مربی هنوز فعال نشده است: به‌روزرسانی «اشتراک و پرداخت کارت‌به‌کارت مربی به
            پلتفرم» را از صفحهٔ پایگاه‌داده اجرا کنید.
          </p>
        </Card>
      ) : (
        <Tabs defaultValue="requests" className="space-y-4">
          <TabsList>
            <TabsTrigger value="requests">پرداخت‌ها ({formatNumber(pendingCount)} در انتظار)</TabsTrigger>
            <TabsTrigger value="plans">پلن‌ها</TabsTrigger>
            <TabsTrigger value="discounts">کدهای تخفیف</TabsTrigger>
            <TabsTrigger value="subscriptions">اشتراک‌ها</TabsTrigger>
          </TabsList>
          <TabsContent value="requests">
            <RequestsTab rows={requests.data?.items ?? []} />
          </TabsContent>
          <TabsContent value="plans">
            <PlansTab />
          </TabsContent>
          <TabsContent value="discounts" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              مربیان هنگام خرید پلن کد را وارد می‌کنند و مبلغ با تخفیف حساب می‌شود. هر پرداختِ در انتظار
              یا تأییدشده یک بار استفاده حساب می‌شود؛ پرداختی که رد شود، استفاده‌اش برمی‌گردد. کدی که
              کل مبلغ را بپوشاند، بدون رسید ثبت می‌شود و شما آن را تأیید می‌کنید.
            </p>
            <DiscountCodesManager config={DISCOUNT_CONFIG} />
          </TabsContent>
          <TabsContent value="subscriptions">
            <SubscriptionsTab />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

function RequestsTab({ rows }: { rows: AdminTrainerRequest[] }) {
  const [filter, setFilter] = useState<"pending" | "reviewed">("pending");
  const shown = rows.filter((r) => (filter === "pending" ? r.status === "pending" : r.status !== "pending"));

  return (
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
            {value === "pending" ? "در انتظار" : "بررسی‌شده"}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="px-6">
          <EmptyState
            icon={ReceiptText}
            title="درخواستی وجود ندارد."
            description="با ثبت پرداخت توسط مربیان، اینجا نمایش داده می‌شود."
          />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>مربی</TableHead>
              <TableHead>پلن و مبلغ</TableHead>
              <TableHead>کد پیگیری</TableHead>
              <TableHead>رسید</TableHead>
              <TableHead>تاریخ</TableHead>
              <TableHead>وضعیت</TableHead>
              {filter === "pending" && <TableHead>اقدام</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((request) => (
              <TableRow key={request.id}>
                <TableCell>
                  <p className="font-medium text-foreground">{fullName(request.first_name, request.last_name)}</p>
                  {request.phone && (
                    <p dir="ltr" className="text-end text-xs text-muted-foreground">
                      {request.phone}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {request.plan_name}
                  <p className="text-xs">{formatToman(request.amount_toman)} تومان</p>
                  {!!request.discount_toman && request.discount_toman > 0 && (
                    <p className="text-xs">
                      {request.list_price_toman != null && (
                        <span className="line-through">{formatToman(request.list_price_toman)}</span>
                      )}{" "}
                      کد <span dir="ltr" className="font-mono">{request.discount_code ?? "—"}</span>
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
                    <p dir="ltr" className="text-end font-mono text-xs text-foreground">
                      {request.tracking_code}
                    </p>
                    <p className="text-xs">
                      کارت ••••{" "}
                      <span dir="ltr" className="font-mono">
                        {request.card_last4}
                      </span>
                    </p>
                    {request.paid_at && (
                      <p className="text-xs">واریز: {formatPersianDate(parseDate(request.paid_at))}</p>
                    )}
                    {request.duplicate_tracking && <Badge variant="warning">کد پیگیری تکراری</Badge>}
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
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[request.status]}>{STATUS_LABEL[request.status]}</Badge>
                </TableCell>
                {filter === "pending" && (
                  <TableCell>
                    <ReviewActions requestId={request.id} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
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
        <Button size="sm" variant="destructive" onClick={() => setMode("reject")}>
          <X />
          رد
        </Button>
      </div>
      <Dialog open={mode !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "approve" ? "تایید پرداخت مربی" : "رد پرداخت مربی"}</DialogTitle>
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
              placeholder={mode === "approve" ? "مثلاً شمارهٔ تراکنش بانکی" : "دلیل رد درخواست"}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>
              انصراف
            </Button>
            <Button variant={mode === "reject" ? "destructive" : "default"} onClick={confirm} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {mode === "approve" ? "تایید و فعال‌سازی" : "رد درخواست"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

function PlanActiveSwitch({ plan }: { plan: TrainerPlan }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function toggle(isActive: boolean) {
    setBusy(true);
    try {
      await updateTrainerPlan(plan.id, { isActive });
      void queryClient.invalidateQueries({ queryKey: ["admin", "trainer-plans"] });
      void queryClient.invalidateQueries({ queryKey: ["trainer-billing"] });
    } catch (error) {
      toast.error(getErrorMessage(error, "تغییر وضعیت پلن ناموفق بود."));
    } finally {
      setBusy(false);
    }
  }

  return <Switch checked={plan.is_active ?? true} disabled={busy} onCheckedChange={toggle} aria-label={`فعال بودن ${plan.name}`} />;
}

function PlansTab() {
  const { data, isLoading } = useQuery({ queryKey: ["admin", "trainer-plans"], queryFn: listAdminTrainerPlans });
  const rows = data?.items ?? [];

  return (
    <Card className="gap-4 py-5">
      <div className="flex items-center justify-between gap-3 px-6">
        <p className="text-sm text-muted-foreground">
          پلن‌های مخصوص مربی؛ جدا از پلن‌های باشگاه. سقف ورزشکار فقط وقتی اعمال می‌شود که «الزام اشتراک
          مربی» را در «اطلاعات پرداخت» روشن کرده باشید.
        </p>
        <TrainerPlanDialog />
      </div>
      {isLoading ? (
        <Skeleton className="mx-6 h-24" />
      ) : rows.length === 0 ? (
        <div className="px-6">
          <EmptyState icon={Tags} title="هنوز پلنی تعریف نشده است." description="اولین پلن مربیان را بسازید." />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>نام پلن</TableHead>
              <TableHead>قیمت</TableHead>
              <TableHead>مدت</TableHead>
              <TableHead>سقف ورزشکار</TableHead>
              <TableHead>فعال</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell className="font-medium text-foreground">{plan.name}</TableCell>
                <TableCell className="text-muted-foreground">{formatToman(plan.price_toman)} تومان</TableCell>
                <TableCell className="text-muted-foreground">{formatNumber(plan.duration_days)} روز</TableCell>
                <TableCell className="text-muted-foreground">
                  {plan.max_athletes != null ? `${formatNumber(plan.max_athletes)} نفر` : "بدون محدودیت"}
                </TableCell>
                <TableCell>
                  <PlanActiveSwitch plan={plan} />
                </TableCell>
                <TableCell>
                  <TrainerPlanDialog plan={plan} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Who has what
// ---------------------------------------------------------------------------

function SubscriptionsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "trainer-subscriptions"],
    queryFn: listTrainerSubscriptions,
  });
  const plans = useQuery({ queryKey: ["admin", "trainer-plans"], queryFn: listAdminTrainerPlans });
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<AdminTrainerSubscriptionRow | null>(null);

  const rows = useMemo(() => {
    const term = toAsciiDigits(search).trim().toLowerCase();
    return (data?.items ?? []).filter(
      (row) =>
        !term ||
        fullName(row.first_name, row.last_name).toLowerCase().includes(term) ||
        (row.phone ?? "").includes(term)
    );
  }, [data, search]);

  return (
    <Card className="gap-4 py-5">
      <div className="flex flex-col gap-3 px-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {data?.enforcing
            ? "الزام اشتراک روشن است: مربی بدون اشتراک فعال نمی‌تواند ورزشکار تازه دعوت کند."
            : "الزام اشتراک خاموش است: هنوز هیچ مربی‌ای محدود نمی‌شود. از «اطلاعات پرداخت» روشنش کنید."}{" "}
          <Link href="/admin/billing" className="text-primary underline-offset-4 hover:underline">
            اطلاعات پرداخت
          </Link>
        </p>
        <Input
          className="sm:w-64"
          placeholder="جستجوی نام یا تلفن"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {isLoading ? (
        <Skeleton className="mx-6 h-24" />
      ) : rows.length === 0 ? (
        <div className="px-6">
          <EmptyState icon={UserCheck} title="مربی‌ای پیدا نشد." description="" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>مربی</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead>پلن</TableHead>
              <TableHead>انقضا</TableHead>
              <TableHead>ورزشکاران</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.trainer_id}>
                <TableCell className="font-medium text-foreground">
                  {fullName(row.first_name, row.last_name)}
                  {row.in_club && (
                    <Badge variant="secondary" className="ms-2">
                      عضو باشگاه
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <SubscriptionStatusBadge status={row.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">{row.plan_name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {row.expires_at ? formatPersianDate(parseDate(row.expires_at)) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatNumber(row.athlete_count)}
                  {row.max_athletes != null && ` از ${formatNumber(row.max_athletes)}`}
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => setTarget(row)}>
                    <Gift />
                    افزودن روز
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <GrantDialog target={target} plans={plans.data?.items ?? []} onClose={() => setTarget(null)} />
    </Card>
  );
}

function GrantDialog({
  target,
  plans,
  onClose,
}: {
  target: AdminTrainerSubscriptionRow | null;
  plans: TrainerPlan[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [days, setDays] = useState("30");
  const [planId, setPlanId] = useState("");
  const [busy, setBusy] = useState(false);

  async function grant() {
    const count = Number(toAsciiDigits(days).replace(/\D+/g, ""));
    if (!target || !count || count > 3650) {
      toast.error("تعداد روز باید بین ۱ و ۳۶۵۰ باشد.");
      return;
    }
    setBusy(true);
    try {
      await grantTrainerDays({ trainerId: target.trainer_id, days: count, planId: planId || null });
      toast.success("روزها اضافه شد و مربی مطلع شد.");
      onClose();
      void queryClient.invalidateQueries({ queryKey: ["admin", "trainer-subscriptions"] });
    } catch (error) {
      toast.error(getErrorMessage(error, "افزودن روز ناموفق بود."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>افزودن روز به اشتراک {target ? fullName(target.first_name, target.last_name) : ""}</DialogTitle>
          <DialogDescription>
            روزها از انقضای فعلی (یا از امروز، اگر تمام شده) اضافه می‌شوند. بدون انتخاب پلن، پلن فعلی مربی می‌ماند.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="grant-days">تعداد روز</Label>
            <Input id="grant-days" dir="ltr" inputMode="numeric" className="w-28" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="grant-plan">
              پلن <span className="text-muted-foreground">(اختیاری)</span>
            </Label>
            <select
              id="grant-plan"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
            >
              <option value="">پلن فعلی مربی</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            انصراف
          </Button>
          <Button onClick={grant} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            افزودن
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
