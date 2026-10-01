"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import type { AdminClubRow, CatalogPlanRow } from "../services/admin-service";
import { updateSubscription, type SubscriptionChange } from "../services/admin-billing-service";
import { SubscriptionStatusBadge } from "./subscription-status-badge";

type Mode = "renew" | "gift" | "set";

/**
 * Changing one club's subscription by hand: a plan's period (optionally
 * recording money received outside the site), gift days, or the expiry
 * and member cap exactly as the admin wants them.
 */
export function SubscriptionDialog({
  club,
  plans,
  onClose,
  onSaved,
}: {
  club: AdminClubRow | null;
  plans: CatalogPlanRow[];
  onClose: () => void;
  onSaved: (club: AdminClubRow | null) => void;
}) {
  return (
    <Dialog open={!!club} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        {club && <SubscriptionForm key={club.id} club={club} plans={plans} onClose={onClose} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function SubscriptionForm({
  club,
  plans,
  onClose,
  onSaved,
}: {
  club: AdminClubRow;
  plans: CatalogPlanRow[];
  onClose: () => void;
  onSaved: (club: AdminClubRow | null) => void;
}) {
  const [mode, setMode] = useState<Mode>("renew");
  const [planId, setPlanId] = useState(plans.find((p) => p.is_active)?.id ?? plans[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("7");
  const [expiresAt, setExpiresAt] = useState(() =>
    club.subscription_expires_at ? club.subscription_expires_at.slice(0, 10) : toIsoDate(new Date())
  );
  const [planName, setPlanName] = useState(club.plan_name ?? "");
  const [capacity, setCapacity] = useState(club.member_capacity != null ? String(club.member_capacity) : "");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);

  const plan = plans.find((p) => p.id === planId);

  function change(): SubscriptionChange | string {
    if (mode === "renew") {
      if (!plan) return "یک پلن انتخاب کنید.";
      const value = amount.trim() === "" ? null : parseLocaleNumber(amount);
      if (value !== null && (Number.isNaN(value) || value < 0)) return "مبلغ دریافتی معتبر نیست.";
      return { action: "renew", plan_id: plan.id, amount_toman: value };
    }
    if (mode === "gift") {
      const value = parseLocaleNumber(days);
      if (value === null || !Number.isInteger(value) || value < 1 || value > 3650) {
        return "تعداد روز باید بین ۱ و ۳۶۵۰ باشد.";
      }
      return { action: "gift", days: value };
    }
    if (!planName.trim()) return "نام پلن را وارد کنید.";
    const cap = capacity.trim() === "" ? null : parseLocaleNumber(capacity);
    if (cap !== null && (!Number.isInteger(cap) || cap < 1)) return "ظرفیت عضو باید عددی مثبت باشد.";
    return { action: "set", expires_at: expiresAt, plan_name: planName.trim(), member_capacity: cap };
  }

  async function save() {
    const payload = change();
    if (typeof payload === "string") {
      toast.error(payload);
      return;
    }
    setSaving(true);
    try {
      const updated = await updateSubscription(club.id, payload, { note: note.trim(), notify });
      toast.success("اشتراک باشگاه به‌روزرسانی شد.");
      onSaved(updated);
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, "به‌روزرسانی اشتراک ناموفق بود."));
    } finally {
      setSaving(false);
    }
  }

  const ending = mode === "set" && new Date(`${expiresAt}T23:59:59`).getTime() < Date.now();

  return (
    <>
      <DialogHeader>
        <DialogTitle>اشتراک «{club.name}»</DialogTitle>
        <DialogDescription asChild>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {club.subscription_expires_at ? (
              <>
                <span>
                  {club.plan_name} — تا {formatPersianDate(new Date(club.subscription_expires_at))}
                </span>
                <SubscriptionStatusBadge status={club.subscription_status} />
              </>
            ) : (
              <span>این باشگاه هنوز اشتراکی ندارد.</span>
            )}
          </div>
        </DialogDescription>
      </DialogHeader>

      <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)} className="space-y-4">
        <TabsList className="w-full">
          <TabsTrigger value="renew">تمدید با پلن</TabsTrigger>
          <TabsTrigger value="gift">روز هدیه</TabsTrigger>
          <TabsTrigger value="set">تنظیم دستی</TabsTrigger>
        </TabsList>

        <TabsContent value="renew" className="space-y-4">
          <p className="text-xs leading-5 text-muted-foreground">
            مثل تأیید یک پرداخت: مدت پلن به اشتراک اضافه می‌شود (اگر اشتراک هنوز تمام نشده، از تاریخ
            انقضای فعلی) و سقف عضو باشگاه همان سقف پلن می‌شود. اگر پول را بیرون از سایت گرفته‌اید،
            مبلغ را بنویسید تا در گزارش مالی هم بیاید.
          </p>
          <div className="space-y-2">
            <Label>پلن</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="یک پلن انتخاب کنید" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {formatNumber(p.duration_days)} روز
                    {!p.is_active && " (غیرفعال)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {plan && (
              <p className="text-xs text-muted-foreground">
                قیمت: {formatToman(plan.price_toman)} تومان · سقف عضو:{" "}
                {plan.max_members != null ? formatNumber(plan.max_members) : "بدون محدودیت"}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="renew-amount">
              مبلغ دریافتی (تومان) <span className="text-muted-foreground">(اختیاری)</span>
            </Label>
            <Input
              id="renew-amount"
              dir="ltr"
              inputMode="numeric"
              value={amount}
              placeholder={plan ? String(plan.price_toman) : ""}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              خالی یعنی تمدید رایگان؛ چیزی در گزارش مالی ثبت نمی‌شود.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="gift" className="space-y-4">
          <p className="text-xs leading-5 text-muted-foreground">
            روزهای هدیه به انتهای اشتراک اضافه می‌شوند؛ اگر اشتراک تمام شده باشد، از امروز. پلن و
            ظرفیت تغییر نمی‌کند.
          </p>
          <div className="space-y-2">
            <Label htmlFor="gift-days">تعداد روز</Label>
            <Input
              id="gift-days"
              dir="ltr"
              inputMode="numeric"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </div>
        </TabsContent>

        <TabsContent value="set" className="space-y-4">
          <p className="text-xs leading-5 text-muted-foreground">
            همه‌چیز دقیقاً همان می‌شود که اینجا وارد می‌کنید. برای پایان‌دادن به اشتراک، تاریخ گذشته
            یا امروز را بگذارید.
          </p>
          <JalaliDateField
            id="set-expires"
            label="اعتبار تا پایان روز"
            value={expiresAt}
            onChange={setExpiresAt}
            pastYears={2}
            futureYears={5}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="set-plan-name">نام پلن</Label>
              <Input id="set-plan-name" value={planName} maxLength={255} onChange={(e) => setPlanName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="set-capacity">سقف عضو</Label>
              <Input
                id="set-capacity"
                dir="ltr"
                inputMode="numeric"
                value={capacity}
                placeholder="خالی = بدون محدودیت"
                onChange={(e) => setCapacity(e.target.value)}
              />
            </div>
          </div>
          {ending && <p className="text-xs text-destructive">با این تاریخ، اشتراک باشگاه تمام‌شده حساب می‌شود.</p>}
        </TabsContent>
      </Tabs>

      <div className="space-y-2">
        <Label htmlFor="subscription-note">
          یادداشت{" "}
          <span className="text-muted-foreground">
            {mode === "gift" ? "(اختیاری، در لاگ فعالیت و متن اعلان)" : "(اختیاری، در لاگ فعالیت)"}
          </span>
        </Label>
        <Input
          id="subscription-note"
          value={note}
          maxLength={500}
          placeholder={mode === "gift" ? "مثلاً: بابت قطعی سایت" : "مثلاً: پرداخت نقدی حضوری"}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <label className="flex cursor-pointer items-center gap-3 text-sm">
        <Switch checked={notify} onCheckedChange={setNotify} />
        به مالک باشگاه اعلان بده
      </label>

      <DialogFooter>
        <Button onClick={save} disabled={saving} variant={ending ? "destructive" : "default"}>
          {saving && <Loader2 className="animate-spin" />}
          {mode === "renew" ? "تمدید" : mode === "gift" ? "افزودن روز هدیه" : "ذخیره"}
        </Button>
      </DialogFooter>
    </>
  );
}
