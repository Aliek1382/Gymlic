"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
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
import { ROLE_LABEL } from "@/components/layout/sidebar-nav";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber, formatToman, parseLocaleNumber } from "@/lib/persian";
import { cn } from "@/lib/utils";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import type { FeatureKey, TierKey, TiersSettings } from "@/features/site-settings";
import {
  getTiers,
  saveTiers,
  setPlanTier,
  type TierPlanRow,
  type TiersOverview,
} from "../services/admin-ops-service";
import { MigrationNotice } from "./migration-notice";

const TIER_STYLE: Record<TierKey, string> = {
  free: "bg-muted text-muted-foreground",
  silver: "bg-slate-200 text-slate-700",
  gold: "bg-amber-100 text-amber-800",
  diamond: "bg-sky-100 text-sky-800",
};

/** /admin/tiers — what free / silver / gold / diamond open, and which tier each plan is. */
export function AdminTiersPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["admin", "tiers"], queryFn: getTiers });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">سطح پلن‌ها</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          هر پلن باشگاه و هر پلن مربی یکی از سطح‌های رایگان، نقره‌ای، طلایی یا الماسی است. کسی که پلنی را می‌خرد (یا شما
          برایش ثبت یا تمدید می‌کنید) سطح همان پلن را می‌گیرد و هر بخشی که برای آن سطح خاموش باشد برایش باز نمی‌شود. سقف
          تعداد ورزشکار و عضو، مدت و قیمت همچنان از خود پلن است. کسی که پلن فعالی ندارد «رایگان» حساب می‌شود؛ ورزشکار سطحِ
          مربی‌اش را دارد. تا وقتی چیزی را خاموش نکنید، همهٔ سطح‌ها همه‌چیز را باز می‌کنند.
        </p>
      </div>

      {data && !data.ready && <MigrationNotice title="سطح پلن‌ها: رایگان، نقره‌ای، طلایی و الماسی (فاز ۱۰؛ بعد از «اشتراک مربی»)" />}

      {isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : isError || !data ? (
        <ErrorState message="دریافت سطح پلن‌ها ناموفق بود." />
      ) : (
        <>
          <PlansCard data={data} />
          <MatrixCard key={JSON.stringify(data.config)} data={data} />
        </>
      )}
    </div>
  );
}

function PlansCard({ data }: { data: TiersOverview }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const label = (tier: TierKey) => data.config[tier]?.label ?? tier;

  async function change(kind: "club" | "trainer", plan: TierPlanRow, value: string) {
    setBusy(plan.id);
    try {
      const tier = value === "" ? null : (value as TierKey);
      const { subscriptions_updated } = await setPlanTier(kind, plan.id, tier);
      toast.success(
        `«${plan.name}» ${tier ? `سطح ${label(tier)} شد` : "بدون سطح شد"}.` +
          (subscriptions_updated > 0 ? ` ${formatNumber(subscriptions_updated)} اشتراک فعال با این پلن هم همین سطح را گرفت.` : "")
      );
      void queryClient.invalidateQueries({ queryKey: ["admin", "tiers"] });
    } catch (error) {
      toast.error(getErrorMessage(error, "انجام نشد."));
    } finally {
      setBusy(null);
    }
  }

  const rows = (kind: "club" | "trainer", plans: TierPlanRow[]) =>
    plans.length === 0 ? (
      <p className="py-4 text-sm text-muted-foreground">پلنی تعریف نشده است.</p>
    ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>پلن</TableHead>
            <TableHead>مدت / قیمت</TableHead>
            <TableHead>سقف</TableHead>
            <TableHead className="w-44">سطح</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.map((plan) => {
            const cap = kind === "club" ? plan.max_members : plan.max_athletes;
            return (
              <TableRow key={plan.id} className={plan.is_active ? undefined : "opacity-60"}>
                <TableCell className="font-medium text-foreground">
                  {plan.name}
                  {!plan.is_active && <span className="ms-2 text-xs text-muted-foreground">(غیرفعال)</span>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatNumber(plan.duration_days)} روز · {formatToman(plan.price_toman)} تومان
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {cap == null ? "نامحدود" : `${formatNumber(cap)} ${kind === "club" ? "عضو" : "ورزشکار"}`}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <select
                      aria-label={`سطح ${plan.name}`}
                      disabled={!data.ready || busy !== null}
                      className={cn(
                        "h-8 w-full rounded-lg border border-input px-2 text-sm",
                        plan.tier ? TIER_STYLE[plan.tier] : "bg-transparent"
                      )}
                      value={plan.tier ?? ""}
                      onChange={(e) => change(kind, plan, e.target.value)}
                    >
                      <option value="">بدون سطح (همه‌چیز باز)</option>
                      {data.tiers.map((tier) => (
                        <option key={tier} value={tier}>
                          {label(tier)}
                        </option>
                      ))}
                    </select>
                    {busy === plan.id && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );

  const running = (group: Record<string, number>) =>
    [...data.tiers.map((t) => [label(t), group[t] ?? 0] as const), ["بدون سطح", group[""] ?? 0] as const]
      .filter(([, n]) => n > 0)
      .map(([name, n]) => `${name} ${formatNumber(n)}`)
      .join(" · ") || "هیچ";

  return (
    <Card className="gap-5 py-5">
      <div className="px-6">
        <CardTitle className="text-base">سطح هر پلن</CardTitle>
        <CardDescription className="text-xs leading-5">
          پلن‌ها را در{" "}
          <Link href="/admin/plans" className="text-primary underline underline-offset-4">
            پلن‌ها
          </Link>{" "}
          و{" "}
          <Link href="/admin/trainer-billing" className="text-primary underline underline-offset-4">
            اشتراک مربیان
          </Link>{" "}
          می‌سازید؛ اینجا فقط سطحشان را تعیین می‌کنید. اشتراک‌های فعالی که با همین پلن خریده شده‌اند و هنوز سطح ندارند، همان
          لحظه این سطح را می‌گیرند.
        </CardDescription>
      </div>
      <div className="space-y-6 px-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">پلن‌های باشگاه</h3>
            <span className="text-xs text-muted-foreground">اشتراک‌های فعال: {running(data.running.clubs)}</span>
          </div>
          {rows("club", data.club_plans)}
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">پلن‌های مربی</h3>
            <span className="text-xs text-muted-foreground">اشتراک‌های فعال: {running(data.running.trainers)}</span>
          </div>
          {data.trainer_ready ? (
            rows("trainer", data.trainer_plans)
          ) : (
            <p className="text-sm text-muted-foreground">اشتراک مربی هنوز فعال نشده است.</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function MatrixCard({ data }: { data: TiersOverview }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<TiersSettings>(data.config);
  const [athletes, setAthletes] = useState(data.config.free_limits.max_athletes?.toString() ?? "");
  const [members, setMembers] = useState(data.config.free_limits.max_members?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  const toggle = (tier: TierKey, key: FeatureKey, on: boolean) =>
    setDraft((d) => ({ ...d, [tier]: { ...d[tier], features: { ...d[tier].features, [key]: on } } }));

  function cap(value: string): number | null | "bad" {
    if (value.trim() === "") return null;
    const n = parseLocaleNumber(value);
    return n === null || !Number.isInteger(n) || n < 0 ? "bad" : n;
  }

  async function save() {
    const maxAthletes = cap(athletes);
    const maxMembers = cap(members);
    if (maxAthletes === "bad" || maxMembers === "bad") {
      toast.error("سقف‌ها باید عدد صحیح باشند، یا خالی برای بدون محدودیت.");
      return;
    }
    setSaving(true);
    try {
      await saveTiers({ ...draft, free_limits: { max_athletes: maxAthletes, max_members: maxMembers } });
      toast.success("سطح‌ها ذخیره شد و همین حالا اعمال می‌شود.");
      void queryClient.invalidateQueries({ queryKey: ["admin", "tiers"] });
      void queryClient.invalidateQueries({ queryKey: ["site-settings"] });
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیره انجام نشد."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="gap-5 py-5">
      <div className="flex items-start gap-3 px-6">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Layers className="size-4" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-base">هر سطح چه بخش‌هایی را باز می‌کند</CardTitle>
          <CardDescription className="text-xs leading-5">
            بخشی که برای یک سطح خاموش است، برای مربی و باشگاهِ آن سطح (و شاگردانشان) در منو دیده نمی‌شود و API هم آن را رد
            می‌کند. خاموش‌کردن یک بخش برای همه، همچنان از «مدیریت بخش‌ها» است.
          </CardDescription>
        </div>
      </div>

      <div className="overflow-x-auto px-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>بخش</TableHead>
              {data.tiers.map((tier) => (
                <TableHead key={tier} className="min-w-28 text-center">
                  <Input
                    aria-label={`نام سطح ${tier}`}
                    className={cn("h-8 text-center text-xs font-semibold", TIER_STYLE[tier])}
                    maxLength={30}
                    value={draft[tier].label}
                    onChange={(e) => setDraft((d) => ({ ...d, [tier]: { ...d[tier], label: e.target.value } }))}
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.catalog.map((feature) => (
              <TableRow key={feature.key}>
                <TableCell>
                  <p className="font-medium text-foreground">{feature.label}</p>
                  <p className="text-xs text-muted-foreground">{feature.roles.map((r) => ROLE_LABEL[r]).join("، ")}</p>
                </TableCell>
                {data.tiers.map((tier) => (
                  <TableCell key={tier} className="text-center">
                    <Switch
                      aria-label={`${feature.label} در سطح ${draft[tier].label}`}
                      checked={draft[tier].features[feature.key] !== false}
                      onCheckedChange={(on) => toggle(tier, feature.key, on)}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-1 gap-4 px-6 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="free-athletes">سقف ورزشکار مربیِ بدون پلن</Label>
          <Input id="free-athletes" dir="ltr" placeholder="بدون محدودیت" value={athletes} onChange={(e) => setAthletes(e.target.value)} />
          <p className="text-xs text-muted-foreground">برای مربی مستقلی که پلن فعالی ندارد (اگر خرید اشتراک مربی اجباری نباشد).</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="free-members">سقف عضو باشگاهِ بدون پلن</Label>
          <Input id="free-members" dir="ltr" placeholder="بدون محدودیت" value={members} onChange={(e) => setMembers(e.target.value)} />
          <p className="text-xs text-muted-foreground">برای باشگاهی که اشتراک فعالی ندارد.</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-6 pt-4">
        <div className="flex flex-wrap gap-1.5">
          {data.tiers.map((tier) => (
            <Badge key={tier} variant="outline" className={TIER_STYLE[tier]}>
              {draft[tier].label}: {formatNumber(data.catalog.filter((f) => draft[tier].features[f.key] !== false).length)} بخش
            </Badge>
          ))}
        </div>
        <Button onClick={save} disabled={saving || !data.storage_ready}>
          {saving && <Loader2 className="animate-spin" />}
          ذخیره
        </Button>
      </div>
    </Card>
  );
}
