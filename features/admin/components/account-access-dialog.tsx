"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ROLE_LABEL } from "@/components/layout/sidebar-nav";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber, parseLocaleNumber } from "@/lib/persian";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import type { FeatureKey, TierKey } from "@/features/site-settings";
import { TIER_KEYS } from "@/features/site-settings";
import {
  getAccountAccess,
  saveAccountAccess,
  type AccessLimits,
  type AccountAccessInfo,
  type PlanAccount,
  type ReportLevel,
} from "../services/plan-accounts-service";
import { MigrationNotice } from "./migration-notice";

const REPORT_LABEL: Record<ReportLevel, string> = {
  count: "فقط تعداد",
  basic: "پایه",
  full: "کامل",
  full_excel: "کامل + Excel",
};

/** A number cap's three states: as the plan, a number, or none. */
type CapMode = "plan" | "number" | "none";

const CAPS: { key: "max_custom_exercises" | "max_templates" | "history_months"; label: string; unit: string }[] = [
  { key: "max_custom_exercises", label: "حرکت سفارشی", unit: "حرکت" },
  { key: "max_templates", label: "قالب برنامه", unit: "قالب" },
  { key: "history_months", label: "نمایش برنامه‌های قدیمی", unit: "ماه" },
];

const PILL =
  "rounded-full border border-border px-3 py-1 text-xs transition-colors hover:bg-muted data-[active=true]:border-primary data-[active=true]:bg-accent data-[active=true]:text-accent-foreground";

/**
 * One trainer's or club's access set by hand, whatever their plan says: a
 * fixed tier, sections switched on or off one by one, and (trainers) the
 * content caps. Kept until cleared here; a plan change doesn't touch it.
 */
export function AccountAccessDialog({
  kind,
  id,
  name,
  open,
  onClose,
}: {
  kind: PlanAccount["kind"];
  id: string;
  name: string;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>دسترسی اختصاصی {name}</DialogTitle>
          <DialogDescription>
            هر چیزی که اینجا تعیین کنید، مستقل از پلن {kind === "trainer" ? "این مربی" : "این باشگاه"} اعمال می‌شود و با
            خرید یا تمدید پلن تغییر نمی‌کند؛ هر مورد روی «طبق پلن» بماند، همان پلن تصمیم می‌گیرد.
            {kind === "trainer"
              ? " شاگردان این مربی هم همین دسترسی را می‌گیرند."
              : " مربی‌ها و ورزشکاران این باشگاه هم همین را می‌گیرند، مگر برای خود مربی چیز دیگری تعیین شده باشد."}
          </DialogDescription>
        </DialogHeader>
        {open && <AccessBody kind={kind} id={id} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function AccessBody({ kind, id, onClose }: { kind: PlanAccount["kind"]; id: string; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "account-access", kind, id],
    queryFn: () => getAccountAccess(kind, id),
  });

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;
  if (isError || !data) return <ErrorState message="دریافت دسترسی‌ها ناموفق بود." />;
  if (!data.ready) return <MigrationNotice title="دسترسی اختصاصی هر مربی و باشگاه" />;
  return <AccessForm key={data.access?.updated_at ?? "none"} kind={kind} id={id} info={data} onClose={onClose} />;
}

function capMode(value: number | undefined): CapMode {
  if (value === undefined) return "plan";
  return value < 0 ? "none" : "number";
}

function AccessForm({
  kind,
  id,
  info,
  onClose,
}: {
  kind: PlanAccount["kind"];
  id: string;
  info: AccountAccessInfo;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const saved = info.access;
  const [tier, setTier] = useState<TierKey | null>(saved?.tier ?? null);
  const [features, setFeatures] = useState<Partial<Record<FeatureKey, boolean>>>(saved?.features ?? {});
  const [modes, setModes] = useState<Record<string, CapMode>>(() =>
    Object.fromEntries(CAPS.map((cap) => [cap.key, capMode(saved?.limits[cap.key])]))
  );
  const [numbers, setNumbers] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      CAPS.map((cap) => {
        const value = saved?.limits[cap.key];
        return [cap.key, value !== undefined && value >= 0 ? String(value) : ""];
      })
    )
  );
  const [report, setReport] = useState<ReportLevel | "">(saved?.limits.report_level ?? "");
  const [note, setNote] = useState(saved?.note ?? "");
  const [saving, setSaving] = useState(false);

  const labels = info.tier_labels;
  const planTierLabel = info.plan_tier ? labels[info.plan_tier] : "بدون سطح (محدود نمی‌شود)";
  const plan = info.plan_limits;
  // Sections that make sense for this kind of account (and those under it).
  const catalog = info.catalog.filter((entry) =>
    kind === "trainer" ? entry.roles.some((role) => role !== "club") : true
  );

  function setFeature(key: FeatureKey, value: boolean | null) {
    setFeatures((current) => {
      const next = { ...current };
      if (value === null) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  function limits(): AccessLimits | string {
    const out: AccessLimits = {};
    for (const cap of CAPS) {
      const mode = modes[cap.key];
      if (mode === "none") out[cap.key] = -1;
      if (mode === "number") {
        const value = parseLocaleNumber(numbers[cap.key] ?? "");
        if (value === null || value < 0 || !Number.isInteger(value)) return `سقف «${cap.label}» را به عدد وارد کنید.`;
        out[cap.key] = value;
      }
    }
    if (report) out.report_level = report;
    return out;
  }

  async function save(reset = false) {
    const caps = reset ? {} : limits();
    if (typeof caps === "string") {
      toast.error(caps);
      return;
    }
    setSaving(true);
    try {
      await saveAccountAccess(kind, id, {
        tier: reset ? null : tier,
        features: reset ? {} : features,
        limits: kind === "trainer" ? caps : {},
        note: reset ? "" : note.trim(),
      });
      toast.success(reset ? "همه‌چیز به حالت پلن برگشت." : "دسترسی اختصاصی ذخیره شد.");
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیره ناموفق بود."));
    } finally {
      setSaving(false);
    }
  }

  const planCapText = (key: (typeof CAPS)[number]["key"], unit: string) => {
    const value = plan?.[key];
    return value === null || value === undefined ? "بدون محدودیت" : `${formatNumber(value)} ${unit}`;
  };

  return (
    <div className="space-y-6">
      {/* Tier */}
      <section className="space-y-2">
        <Label>سطح پلن</Label>
        {!info.tiers_ready ? (
          <p className="text-xs text-muted-foreground">سطح پلن‌ها هنوز فعال نیست (به‌روزرسانی «سطح پلن‌ها»).</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" data-active={tier === null} className={PILL} onClick={() => setTier(null)}>
                طبق پلن ({planTierLabel})
              </button>
              {TIER_KEYS.map((key) => (
                <button key={key} type="button" data-active={tier === key} className={PILL} onClick={() => setTier(key)}>
                  {labels[key]}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              سطح ثابت، بخش‌هایی را که در «سطح پلن‌ها» برای آن سطح تعیین کرده‌اید باز می‌کند، هر پلنی که داشته باشد.
            </p>
          </>
        )}
      </section>

      {/* Sections */}
      <section className="space-y-2">
        <Label>بخش‌های پنل</Label>
        <div className="divide-y divide-border rounded-xl border border-border">
          {catalog.map((entry) => {
            const key = entry.key as FeatureKey;
            const set = features[key];
            const viaPlan = info.plan_features[key] ?? true;
            return (
              <div key={key} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{entry.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.roles.map((role) => ROLE_LABEL[role]).join("، ")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" data-active={set === undefined} className={PILL} onClick={() => setFeature(key, null)}>
                    طبق پلن ({viaPlan ? "باز" : "بسته"})
                  </button>
                  <button type="button" data-active={set === true} className={PILL} onClick={() => setFeature(key, true)}>
                    باز
                  </button>
                  <button type="button" data-active={set === false} className={PILL} onClick={() => setFeature(key, false)}>
                    بسته
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          بخشی که در «مدیریت بخش‌ها» برای همه خاموش است، با اینجا روشن نمی‌شود.
        </p>
      </section>

      {/* Trainer caps */}
      {kind === "trainer" && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label>سقف‌ها</Label>
            {!info.enforcing && <Badge variant="warning">اعمال محدودیت پلن‌ها خاموش است</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            جای سقف‌های پلن{plan?.plan_name ? ` «${plan.plan_name}»` : ""} می‌نشیند (حتی وقتی باشگاه مربی پلن فعال دارد).
            مثل سقف‌های پلن، فقط وقتی اعمال می‌شود که «اعمال محدودیت پلن‌ها» در «اطلاعات پرداخت» روشن باشد. سقف تعداد
            شاگرد از «سقف دستی» در پنجرهٔ اشتراک تعیین می‌شود.
          </p>
          {CAPS.map((cap) => (
            <div key={cap.key} className="flex flex-col gap-2 rounded-xl border border-border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-foreground">{cap.label}</p>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  data-active={modes[cap.key] === "plan"}
                  className={PILL}
                  onClick={() => setModes((m) => ({ ...m, [cap.key]: "plan" }))}
                >
                  طبق پلن ({planCapText(cap.key, cap.unit)})
                </button>
                <button
                  type="button"
                  data-active={modes[cap.key] === "none"}
                  className={PILL}
                  onClick={() => setModes((m) => ({ ...m, [cap.key]: "none" }))}
                >
                  بدون محدودیت
                </button>
                <button
                  type="button"
                  data-active={modes[cap.key] === "number"}
                  className={PILL}
                  onClick={() => setModes((m) => ({ ...m, [cap.key]: "number" }))}
                >
                  عدد
                </button>
                {modes[cap.key] === "number" && (
                  <Input
                    dir="ltr"
                    inputMode="numeric"
                    className="h-8 w-20"
                    aria-label={`سقف ${cap.label}`}
                    value={numbers[cap.key] ?? ""}
                    onChange={(e) => setNumbers((n) => ({ ...n, [cap.key]: e.target.value }))}
                  />
                )}
              </div>
            </div>
          ))}
          <div className="flex flex-col gap-2 rounded-xl border border-border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-foreground">سطح گزارش‌ها</p>
            <div className="flex flex-wrap gap-1">
              <button type="button" data-active={report === ""} className={PILL} onClick={() => setReport("")}>
                طبق پلن ({plan?.report_level ? REPORT_LABEL[plan.report_level] : "بدون محدودیت"})
              </button>
              {(Object.keys(REPORT_LABEL) as ReportLevel[]).map((level) => (
                <button key={level} type="button" data-active={report === level} className={PILL} onClick={() => setReport(level)}>
                  {REPORT_LABEL[level]}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="access-note">یادداشت (اختیاری، فقط برای مدیران)</Label>
        <Input
          id="access-note"
          maxLength={500}
          value={note}
          placeholder="مثلاً: هدیهٔ همکاری، تا پایان مهر"
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <DialogFooter className="gap-2 sm:justify-between">
        <Button variant="ghost" disabled={saving || !saved} onClick={() => save(true)}>
          برگرداندن همه به حالت پلن
        </Button>
        <Button disabled={saving} onClick={() => save()}>
          {saving && <Loader2 className="animate-spin" />}
          ذخیره
        </Button>
      </DialogFooter>
    </div>
  );
}
