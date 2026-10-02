"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Loader2 } from "lucide-react";
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
import { JalaliDateField } from "@/components/ui/jalali-date-field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getErrorMessage } from "@/lib/get-error-message";
import { toIsoDate } from "@/lib/iso-date";
import { formatNumber, formatPersianDate, formatToman, parseLocaleNumber } from "@/lib/persian";
import type { TrainerLimits } from "@/features/trainer-billing/services/trainer-billing-service";
import {
  changePlanAccount,
  getPlanAccount,
  previewPlanAccount,
  type AccountPlanOption,
  type ClubLimits,
  type HistoryEntry,
  type PlanAccount,
  type PlanAccountChange,
} from "../services/plan-accounts-service";
import { AccountAccessDialog } from "./account-access-dialog";
import { SUBSCRIPTION_STATUS_LABEL, SubscriptionStatusBadge } from "./subscription-status-badge";

type Mode = "activate" | "dates" | "extend" | "override" | "other" | "history";

const parseDate = (value: string) => new Date(value.replace(" ", "T"));
const showDate = (value: string | null | undefined) => (value ? formatPersianDate(parseDate(value)) : "—");
const showCap = (value: number | null | undefined) => (value == null ? "∞" : formatNumber(value));

/** Activity-log actions of a subscription's history, in words. */
export const PLAN_ACTION_LABEL: Record<string, string> = {
  plan_activate: "فعال‌سازی پلن",
  plan_dates: "تغییر تاریخ اشتراک",
  plan_extend: "تمدید اشتراک",
  plan_override: "تغییر سقف دستی",
  account_access_set: "تغییر دسترسی اختصاصی",
  plan_reactivate: "فعال‌سازی مجدد ورزشکاران",
  plan_revoke_invites: "ابطال دعوت‌های در انتظار",
  trainer_payment_approved: "تأیید پرداخت اشتراک مربی",
  trainer_payment_rejected: "رد پرداخت اشتراک مربی",
  trainer_subscription_granted: "روز هدیه به مربی",
  payment_request_approved: "تأیید پرداخت باشگاه",
  subscription_renewed: "تمدید دستی اشتراک باشگاه",
  subscription_gifted: "روز هدیه به باشگاه",
  subscription_set: "تنظیم دستی اشتراک باشگاه",
  report_excel_export: "خروجی اکسل گزارش (مربی)",
  trainer_data_export: "دریافت همه‌ی اطلاعات (مربی)",
};

/** The plan, dates and caps of one trainer or club, changed by hand. */
export function PlanAccountDialog({
  account,
  plans,
  onClose,
  onSaved,
}: {
  account: PlanAccount | null;
  plans: AccountPlanOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={!!account} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        {account && (
          <AccountForm key={`${account.kind}-${account.id}`} account={account} plans={plans} onClose={onClose} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AccountForm({
  account,
  plans,
  onClose,
  onSaved,
}: {
  account: PlanAccount;
  plans: AccountPlanOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isTrainer = account.kind === "trainer";
  const trainer = isTrainer ? account.limits : null;
  const club = !isTrainer ? account.limits : null;
  const paidExpiry = trainer
    ? trainer.subscription && !trainer.subscription.is_free
      ? trainer.subscription.expires_at
      : null
    : club?.expires_at ?? null;
  const paidStart = trainer ? trainer.subscription?.started_at ?? null : club?.started_at ?? null;
  const sellable = plans.filter((p) => !p.is_free);

  const [mode, setMode] = useState<Mode>("activate");
  const [planId, setPlanId] = useState(sellable.find((p) => p.is_active)?.id ?? sellable[0]?.id ?? "");
  const [startedAt, setStartedAt] = useState(() => toIsoDate(new Date()));
  const [expiresAt, setExpiresAt] = useState(() => toIsoDate(new Date(Date.now() + 30 * 86_400_000)));
  const [newStart, setNewStart] = useState(() => (paidStart ? paidStart.slice(0, 10) : toIsoDate(new Date())));
  const [newEnd, setNewEnd] = useState(() => (paidExpiry ? paidExpiry.slice(0, 10) : toIsoDate(new Date())));
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("30");
  const [overrideOn, setOverrideOn] = useState(
    trainer ? trainer.subscription?.override_on ?? false : club?.override_on ?? false
  );
  const [capAthletes, setCapAthletes] = useState(capText(trainer?.subscription?.override_max_athletes));
  const [capMembers, setCapMembers] = useState(capText(club?.override_max_members));
  const [capTrainers, setCapTrainers] = useState(capText(club?.override_max_trainers));
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [preview, setPreview] = useState<TrainerLimits | ClubLimits | null>(null);

  const plan = sellable.find((p) => p.id === planId);

  /** The change the current tab describes, or why it can't be made. */
  function change(target: Mode = mode): PlanAccountChange | string {
    switch (target) {
      case "activate":
        if (!plan) return "یک پلن انتخاب کنید.";
        if (startedAt > toIsoDate(new Date())) return "تاریخ شروع نمی‌تواند در آینده باشد.";
        if (expiresAt < startedAt) return "تاریخ پایان نباید قبل از تاریخ شروع باشد.";
        {
          const value = amount.trim() === "" ? null : parseLocaleNumber(amount);
          if (value !== null && (Number.isNaN(value) || value < 0)) return "مبلغ دریافتی معتبر نیست.";
          return { action: "activate", plan_id: plan.id, started_at: startedAt, expires_at: expiresAt, amount_toman: value };
        }
      case "dates":
        if (!paidExpiry) return "این حساب پلن پولی ندارد؛ ابتدا یک پلن فعال کنید.";
        if (newStart > toIsoDate(new Date())) return "تاریخ شروع نمی‌تواند در آینده باشد.";
        if (newEnd < newStart) return "تاریخ پایان نباید قبل از تاریخ شروع باشد.";
        return { action: "dates", started_at: newStart, expires_at: newEnd };
      case "extend": {
        const value = parseLocaleNumber(days);
        if (value === null || !Number.isInteger(value) || value < 1 || value > 3650) return "تعداد روز باید بین ۱ و ۳۶۵۰ باشد.";
        return { action: "extend", days: value };
      }
      case "override": {
        const caps = isTrainer ? { max_athletes: capAthletes } : { max_members: capMembers, max_trainers: capTrainers };
        const parsed: Record<string, number | null> = {};
        for (const [key, text] of Object.entries(caps)) {
          const value = text.trim() === "" ? null : parseLocaleNumber(text);
          if (value !== null && (!Number.isInteger(value) || value < 0)) return "سقف باید عددی صحیح و نامنفی باشد.";
          parsed[key] = value;
        }
        return { action: "override", on: overrideOn, ...parsed };
      }
      default:
        return "این بخش تغییری ندارد.";
    }
  }

  async function runPreview() {
    const payload = change();
    if (typeof payload === "string") {
      toast.error(payload);
      return;
    }
    setPreviewing(true);
    try {
      setPreview((await previewPlanAccount(account.kind, account.id, payload)).after);
    } catch (error) {
      toast.error(getErrorMessage(error, "پیش‌نمایش ناموفق بود."));
    } finally {
      setPreviewing(false);
    }
  }

  async function save(payload: PlanAccountChange | string = change()) {
    if (typeof payload === "string") {
      toast.error(payload);
      return;
    }
    setSaving(true);
    try {
      await changePlanAccount(account.kind, account.id, payload, { note: note.trim(), notify });
      toast.success("تغییر ثبت شد.");
      onSaved();
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, "ثبت تغییر ناموفق بود."));
    } finally {
      setSaving(false);
    }
  }

  const actionTab = mode !== "other" && mode !== "history";

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isTrainer ? "مربی" : "باشگاه"} «{account.name || "بی‌نام"}»
        </DialogTitle>
        <DialogDescription asChild>
          <div className="space-y-1">
            <Summary account={account} />
          </div>
        </DialogDescription>
      </DialogHeader>

      <Tabs
        value={mode}
        onValueChange={(value) => {
          setMode(value as Mode);
          setPreview(null);
        }}
      >
        <TabsList className="h-auto w-full flex-wrap justify-start rounded-2xl">
          <TabsTrigger value="activate">فعال‌سازی پلن</TabsTrigger>
          <TabsTrigger value="dates" disabled={!paidExpiry}>تاریخ‌ها</TabsTrigger>
          <TabsTrigger value="extend" disabled={!paidExpiry}>تمدید</TabsTrigger>
          <TabsTrigger value="override">سقف دستی</TabsTrigger>
          <TabsTrigger value="other">سایر</TabsTrigger>
          <TabsTrigger value="history">تاریخچه</TabsTrigger>
        </TabsList>

        <TabsContent value="activate" className="space-y-4 pt-3">
          <div className="space-y-2">
            <Label htmlFor="pa-plan">پلن</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger id="pa-plan" className="w-full">
                <SelectValue placeholder="انتخاب پلن" />
              </SelectTrigger>
              <SelectContent>
                {sellable.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · {formatToman(p.price_toman)} تومان
                    {isTrainer ? ` · ${showCap(p.max_athletes)} ورزشکار` : ` · ${showCap(p.max_members)} عضو / ${showCap(p.max_trainers)} مربی`}
                    {!p.is_active && " (غیرفعال)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <JalaliDateField id="pa-start" label="تاریخ شروع (امروز یا قبل)" value={startedAt} onChange={setStartedAt} />
            <JalaliDateField id="pa-end" label="تاریخ پایان" value={expiresAt} onChange={setExpiresAt} futureYears={3} />
          </div>
          <div className="flex flex-wrap gap-2">
            {[30, 90, 180, 365].map((n) => (
              <Button
                key={n}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setExpiresAt(toIsoDate(new Date(new Date(`${startedAt}T00:00:00`).getTime() + n * 86_400_000)))}
              >
                {n === 365 ? "سالانه (۳۶۵ روز)" : `${formatNumber(n)} روز`}
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="pa-amount">
              مبلغ دریافتی خارج از سایت <span className="text-muted-foreground">(اختیاری، تومان)</span>
            </Label>
            <Input id="pa-amount" dir="ltr" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              با مبلغ، یک پرداخت تأییدشده هم ثبت می‌شود تا در گزارش مالی بیاید. سقف دستیِ قبلی با پلن جدید پاک می‌شود.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="dates" className="space-y-4 pt-3">
          <p className="text-sm text-muted-foreground">
            برای غیرفعال‌کردن پلن پولی، تاریخ پایان را امروز یا گذشته بگذارید: از آن روز مهلت پس از انقضا
            شروع می‌شود و بعد از آن {isTrainer ? "مربی به پلن رایگان برمی‌گردد" : "باشگاه نمی‌تواند عضو یا مربی تازه دعوت کند"}.
            تاریخی قدیمی‌تر از مهلت، تنزل فوری است.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <JalaliDateField id="pa-new-start" label="تاریخ شروع" value={newStart} onChange={setNewStart} />
            <JalaliDateField id="pa-new-end" label="تاریخ پایان" value={newEnd} onChange={setNewEnd} futureYears={3} />
          </div>
        </TabsContent>

        <TabsContent value="extend" className="space-y-4 pt-3">
          <p className="text-sm text-muted-foreground">
            روزها به همین پلن اضافه می‌شود: از تاریخ پایان فعلی اگر هنوز تمام نشده، وگرنه از امروز.
            {isTrainer && " ورزشکاران غیرفعال‌شده همه برمی‌گردند."}
          </p>
          <div className="space-y-2">
            <Label htmlFor="pa-days">تعداد روز</Label>
            <Input id="pa-days" dir="ltr" inputMode="numeric" className="w-28" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
        </TabsContent>

        <TabsContent value="override" className="space-y-4 pt-3">
          <p className="text-sm text-muted-foreground">
            سقف دلخواه برای همین {isTrainer ? "مربی" : "باشگاه"}، مستقل از پلن. با تغییر پلن پاک می‌شود و پس
            از پایان مهلت اشتراک اعمال نمی‌شود. خالی = بدون محدودیت.
          </p>
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <Switch checked={overrideOn} onCheckedChange={setOverrideOn} />
            سقف دستی فعال باشد
          </label>
          {overrideOn &&
            (isTrainer ? (
              <div className="space-y-2">
                <Label htmlFor="pa-cap-athletes">سقف ورزشکار</Label>
                <Input id="pa-cap-athletes" dir="ltr" inputMode="numeric" className="w-28" value={capAthletes} onChange={(e) => setCapAthletes(e.target.value)} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pa-cap-members">سقف عضو</Label>
                  <Input id="pa-cap-members" dir="ltr" inputMode="numeric" value={capMembers} onChange={(e) => setCapMembers(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pa-cap-trainers">سقف مربی</Label>
                  <Input id="pa-cap-trainers" dir="ltr" inputMode="numeric" value={capTrainers} onChange={(e) => setCapTrainers(e.target.value)} />
                </div>
              </div>
            ))}
        </TabsContent>

        <TabsContent value="other" className="space-y-3 pt-3">
          <div className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-medium text-foreground">دسترسی اختصاصی</p>
              <p className="text-xs text-muted-foreground">
                سطح ثابت، باز یا بستن تک‌تک بخش‌ها{isTrainer ? " و سقف حرکت، قالب، تاریخچه و گزارش" : ""}، مستقل از پلن.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setAccessOpen(true)}>
              تنظیم
            </Button>
          </div>
          <AccountAccessDialog
            kind={account.kind}
            id={account.id}
            name={account.name}
            open={accessOpen}
            onClose={() => setAccessOpen(false)}
          />
          {trainer && (
            <div className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="font-medium text-foreground">فعال‌سازی مجدد ورزشکاران غیرفعال</p>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(trainer.usage.suspended)} ورزشکار غیرفعال. تا پایان اشتراک پولی بعدی فعال می‌مانند.
                  (با تمدید یا فعال‌سازی پلن، خودکار انجام می‌شود.)
                </p>
              </div>
              <Button variant="outline" size="sm" disabled={saving || trainer.usage.suspended === 0} onClick={() => save({ action: "reactivate" })}>
                فعال‌سازی مجدد
              </Button>
            </div>
          )}
          <div className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-medium text-foreground">ابطال دعوت‌های در انتظار</p>
              <p className="text-xs text-muted-foreground">
                {trainer
                  ? `${formatNumber(trainer.usage.pending_invites)} دعوت ورزشکار در انتظار.`
                  : `${formatNumber(club!.usage.pending_member_invites)} دعوت عضو و ${formatNumber(club!.usage.pending_trainer_invites)} دعوت مربی در انتظار.`}
              </p>
            </div>
            <Button variant="outline" size="sm" disabled={saving} onClick={() => save({ action: "revoke_invites" })}>
              ابطال همه
            </Button>
          </div>
          <NoteFields note={note} setNote={setNote} notify={null} setNotify={setNotify} />
        </TabsContent>

        <TabsContent value="history" className="pt-3">
          <History account={account} />
        </TabsContent>
      </Tabs>

      {actionTab && (
        <>
          <NoteFields note={note} setNote={setNote} notify={mode === "override" ? null : notify} setNotify={setNotify} />
          {preview && <PreviewPanel account={account} after={preview} />}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={runPreview} disabled={previewing || saving}>
              {previewing ? <Loader2 className="animate-spin" /> : <Eye />}
              پیش‌نمایش اثر
            </Button>
            <Button onClick={() => save()} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              ثبت
            </Button>
          </DialogFooter>
        </>
      )}
    </>
  );
}

function capText(value: number | null | undefined): string {
  return value == null ? "" : String(value);
}

function NoteFields({
  note,
  setNote,
  notify,
  setNotify,
}: {
  note: string;
  setNote: (value: string) => void;
  notify: boolean | null;
  setNotify: (value: boolean) => void;
}) {
  return (
    <div className="space-y-3 pt-3">
      <div className="space-y-2">
        <Label htmlFor="pa-note">
          یادداشت <span className="text-muted-foreground">(اختیاری، در تاریخچه ثبت می‌شود)</span>
        </Label>
        <Input id="pa-note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {notify !== null && (
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <Switch checked={notify} onCheckedChange={setNotify} />
          به کاربر اعلان بده
        </label>
      )}
    </div>
  );
}

/** Plan, state, dates and usage of the account, as it stands now. */
function Summary({ account }: { account: PlanAccount }) {
  if (account.kind === "trainer") {
    const l = account.limits;
    return (
      <>
        <span className="flex flex-wrap items-center gap-2">
          پلن {l.plan.name ?? "—"}
          {l.plan.is_free ? <Badge variant="secondary">رایگان</Badge> : <SubscriptionStatusBadge status={l.status} />}
          {l.override && <Badge variant="info">سقف دستی فعال</Badge>}
        </span>
        {l.subscription && !l.subscription.is_free && (
          <span className="block">
            {showDate(l.subscription.started_at)} تا {showDate(l.subscription.expires_at)} · پایان مهلت{" "}
            {showDate(l.subscription.grace_ends_at)}
          </span>
        )}
        <span className="block">
          ورزشکار: {formatNumber(l.usage.active)} فعال + {formatNumber(l.usage.pending_invites)} دعوت از {showCap(l.max_athletes)}
          {l.usage.suspended > 0 && ` · ${formatNumber(l.usage.suspended)} غیرفعال`}
          {account.club_name && ` · عضو باشگاه «${account.club_name}»`}
        </span>
      </>
    );
  }
  const l = account.limits;
  return (
    <>
      <span className="flex flex-wrap items-center gap-2">
        پلن {l.plan_name ?? "—"}
        <SubscriptionStatusBadge status={l.status} />
        {l.override && <Badge variant="info">سقف دستی فعال</Badge>}
      </span>
      {l.expires_at && (
        <span className="block">
          {showDate(l.started_at)} تا {showDate(l.expires_at)} · پایان مهلت {showDate(l.grace_ends_at)}
        </span>
      )}
      <span className="block">
        عضو: {formatNumber(l.usage.members)} + {formatNumber(l.usage.pending_member_invites)} دعوت از {showCap(l.max_members)} · مربی:{" "}
        {formatNumber(l.usage.trainers)} + {formatNumber(l.usage.pending_trainer_invites)} دعوت از {showCap(l.max_trainers)}
      </span>
    </>
  );
}

/** Where the account would stand after the change (nothing saved yet). */
function PreviewPanel({ account, after }: { account: PlanAccount; after: TrainerLimits | ClubLimits }) {
  const lines: string[] = [];
  if (account.kind === "trainer") {
    const a = after as TrainerLimits;
    lines.push(`پلن ${a.plan.name ?? "—"} · وضعیت ${a.status ? SUBSCRIPTION_STATUS_LABEL[a.status] : "—"}`);
    if (a.subscription?.expires_at && !a.subscription.is_free) {
      lines.push(`پایان ${showDate(a.subscription.expires_at)} · پایان مهلت ${showDate(a.subscription.grace_ends_at)}`);
    }
    lines.push(`سقف ورزشکار ${showCap(a.max_athletes)}${a.override ? " (دستی)" : ""}`);
    if (a.usage.suspended > 0) lines.push(`${formatNumber(a.usage.suspended)} ورزشکار غیرفعال می‌شوند یا می‌مانند.`);
    if (a.suspend_after_grace > 0) {
      lines.push(`پس از پایان مهلت، ${formatNumber(a.suspend_after_grace)} ورزشکار غیرفعال خواهند شد.`);
    }
    if (!a.enforcing) lines.push("محدودیت‌ها اکنون اعمال نمی‌شود (تنظیمات پرداخت).");
  } else {
    const a = after as ClubLimits;
    lines.push(`پلن ${a.plan_name ?? "—"} · وضعیت ${a.status ? SUBSCRIPTION_STATUS_LABEL[a.status] : "بدون اشتراک"}`);
    if (a.expires_at) lines.push(`پایان ${showDate(a.expires_at)} · پایان مهلت ${showDate(a.grace_ends_at)}`);
    lines.push(`سقف عضو ${showCap(a.max_members)} · سقف مربی ${showCap(a.max_trainers)}${a.override ? " (دستی)" : ""}`);
    if (!a.can_invite) lines.push("دعوت عضو و مربی تازه بسته می‌شود (کسی غیرفعال نمی‌شود).");
    if (a.over_cap) lines.push("تعداد فعلی از سقف بیشتر است؛ فقط دعوت تازه بسته می‌شود.");
  }
  return (
    <div className="space-y-1 rounded-xl border border-info/30 bg-info-muted px-4 py-3 text-sm">
      <p className="font-medium text-foreground">پس از ثبت:</p>
      {lines.map((line) => (
        <p key={line} className="text-muted-foreground">
          {line}
        </p>
      ))}
    </div>
  );
}

function History({ account }: { account: PlanAccount }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "plan-account", account.kind, account.id],
    queryFn: () => getPlanAccount(account.kind, account.id),
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>;
  if (isError || !data) return <p className="text-sm text-destructive">دریافت تاریخچه ناموفق بود.</p>;
  if (data.history.length === 0) return <p className="text-sm text-muted-foreground">هنوز تغییری ثبت نشده است.</p>;
  return (
    <ul className="space-y-2">
      {data.history.map((entry) => (
        <HistoryRow key={entry.id} entry={entry} />
      ))}
    </ul>
  );
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const meta = entry.metadata ?? {};
  const after = (meta.after ?? null) as Record<string, unknown> | null;
  const actor = [entry.actor_first_name, entry.actor_last_name].filter(Boolean).join(" ") || "—";
  const details: string[] = [];
  if (typeof meta.plan === "string") details.push(`پلن ${meta.plan}`);
  if (after && typeof after.plan === "string") details.push(`پلن ${after.plan}`);
  const end = (after?.expires_at ?? meta.expires_at) as string | undefined;
  if (end) details.push(`تا ${showDate(end)}`);
  if (typeof meta.days === "number") details.push(`${formatNumber(meta.days)} روز`);
  if (typeof meta.amount === "number" && meta.amount > 0) details.push(`${formatToman(meta.amount)} تومان`);
  if (typeof meta.count === "number") details.push(`${formatNumber(meta.count)} مورد`);
  if (entry.action === "plan_override") details.push(meta.on ? "روشن" : "خاموش");

  return (
    <li className="rounded-xl border border-border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-foreground">{PLAN_ACTION_LABEL[entry.action] ?? entry.action}</span>
        <span className="text-xs text-muted-foreground">
          {formatPersianDate(parseDate(entry.created_at))} · {actor}
        </span>
      </div>
      {details.length > 0 && <p className="text-xs text-muted-foreground">{details.join(" · ")}</p>}
      {typeof meta.note === "string" && meta.note && <p className="text-xs text-foreground">یادداشت: {meta.note}</p>}
    </li>
  );
}
