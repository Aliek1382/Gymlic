"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Loader2, Tags, UserCheck } from "lucide-react";
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
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber, formatPersianDate, formatToman, toAsciiDigits } from "@/lib/persian";
import {
  createTrainerDiscount,
  deleteTrainerDiscount,
  grantTrainerDays,
  listTrainerDiscounts,
  updateTrainerDiscount,
  listAdminTrainerPlans,
  listTrainerSubscriptions,
  updateTrainerPlan,
  type AdminTrainerSubscriptionRow,
  type TrainerPlan,
} from "../services/trainer-billing-service";
import { useAdminCan } from "@/features/admin/hooks/use-admin-access";
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
  personalLabel: "فقط برای یک مربی",
};

const parseDate = (value: string) => new Date(value.replace(" ", "T"));
const fullName = (first: string | null, last: string | null) =>
  [first, last].filter(Boolean).join(" ") || "—";

/**
 * Trainer plans, their discount codes, and who has what. Trainers' payments
 * are reviewed with the clubs' in /admin/payments.
 */
export function AdminTrainerBillingPage() {
  const plans = useQuery({ queryKey: ["admin", "trainer-plans"], queryFn: listAdminTrainerPlans });
  const canReview = useAdminCan()("finance.payments");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">اشتراک مربیان</h1>
        <p className="text-sm text-muted-foreground">
          پلن‌های مخصوص مربی، کدهای تخفیفشان و وضعیت اشتراک هر مربی. کارت دریافت از «اطلاعات پرداخت» می‌آید و همان
          کارت باشگاه‌هاست.
          {canReview && (
            <>
              {" "}
              پرداخت‌ها و رسیدهای مربیان در{" "}
              <Link href="/admin/payments?tab=trainers" className="text-primary underline-offset-4 hover:underline">
                درخواست‌های پرداخت
              </Link>{" "}
              بررسی می‌شوند.
            </>
          )}
        </p>
      </div>

      {plans.isLoading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : plans.isError ? (
        <ErrorState message="دریافت اطلاعات با خطا مواجه شد." />
      ) : plans.data && !plans.data.ready ? (
        <Card className="py-5">
          <p className="px-6 text-sm text-muted-foreground">
            اشتراک مربی هنوز فعال نشده است: به‌روزرسانی «اشتراک و پرداخت کارت‌به‌کارت مربی به
            پلتفرم» را از صفحهٔ پایگاه‌داده اجرا کنید.
          </p>
        </Card>
      ) : (
        <Tabs defaultValue="plans" className="space-y-4">
          <TabsList>
            <TabsTrigger value="plans">پلن‌ها</TabsTrigger>
            <TabsTrigger value="discounts">کدهای تخفیف</TabsTrigger>
            <TabsTrigger value="subscriptions">اشتراک‌ها</TabsTrigger>
          </TabsList>
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

  return (
    <Switch
      checked={plan.is_active ?? true}
      // The free plan is every trainer's fallback: always on.
      disabled={busy || plan.is_free}
      onCheckedChange={toggle}
      aria-label={`فعال بودن ${plan.name}`}
    />
  );
}

function PlansTab() {
  const { data, isLoading } = useQuery({ queryKey: ["admin", "trainer-plans"], queryFn: listAdminTrainerPlans });
  const rows = data?.items ?? [];

  return (
    <Card className="gap-4 py-5">
      <div className="flex items-center justify-between gap-3 px-6">
        <p className="text-sm text-muted-foreground">
          پلن‌های مخصوص مربی؛ جدا از پلن‌های باشگاه. هر مربیِ بدون پلن پولی روی پلن رایگان است. سقف‌ها
          فقط وقتی اعمال می‌شوند که «اعمال محدودیت پلن‌ها» را در «اطلاعات پرداخت» روشن کرده باشید.
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
              {data?.limits && <TableHead>مربی‌ها</TableHead>}
              <TableHead>فعال</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell className="font-medium text-foreground">
                  {plan.name}
                  {plan.is_free && (
                    <Badge variant="secondary" className="ms-2">
                      پیش‌فرض همه
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatToman(plan.price_toman)} تومان</TableCell>
                <TableCell className="text-muted-foreground">
                  {plan.is_free ? "بی‌مهلت" : `${formatNumber(plan.duration_days)} روز`}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {plan.max_athletes != null ? `${formatNumber(plan.max_athletes)} نفر` : "بدون محدودیت"}
                </TableCell>
                {data?.limits && (
                  <TableCell className="text-muted-foreground">
                    {plan.is_free ? "—" : formatNumber(plan.subscriber_count ?? 0)}
                  </TableCell>
                )}
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
            ? "اعمال محدودیت پلن‌ها روشن است."
            : "اعمال محدودیت پلن‌ها خاموش است: هنوز هیچ مربی‌ای محدود نمی‌شود."}{" "}
          <Link href="/admin/billing" className="text-primary underline-offset-4 hover:underline">
            اطلاعات پرداخت
          </Link>
          {" · "}
          فعال‌سازی پلن با تاریخ دلخواه، تغییر تاریخ‌ها، سقف دستی و تاریخچه در{" "}
          <Link href="/admin/subscriptions" className="text-primary underline-offset-4 hover:underline">
            اشتراک‌ها و پلن‌ها
          </Link>
          .
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
