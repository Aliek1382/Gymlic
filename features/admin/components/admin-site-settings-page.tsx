"use client";

import { useState } from "react";
import { Construction, LifeBuoy, Loader2, Megaphone, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ROLE_LABEL } from "@/components/layout/sidebar-nav";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/get-error-message";
import {
  useAdminSiteSettings,
  useUpdateSiteSetting,
  type AnnouncementSettings,
  type AnnouncementTone,
  type MaintenanceSettings,
  type RoleSwitches,
  type SignupSettings,
  type SiteSettingKey,
  type SiteSettings,
  type SupportSettings,
} from "@/features/site-settings";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import type { AccountType } from "@/types/database.types";
import { SettingsStorageNotice } from "./settings-storage-notice";

const ROLES: AccountType[] = ["club", "trainer", "athlete"];

const TEXTAREA_CLASS =
  "w-full rounded-xl border border-input bg-transparent px-4 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-50";

export function AdminSiteSettingsPage() {
  const { data, isLoading, isError } = useAdminSiteSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">تنظیمات سایت</h1>
        <p className="text-sm text-muted-foreground">
          حالت تعمیر، ثبت‌نام، اطلاعیهٔ بالای پنل و راه‌های تماس با پشتیبانی. هر کارت جداگانه ذخیره
          می‌شود و تغییر بلافاصله روی سایت اعمال می‌شود.
        </p>
      </div>

      {data && !data.storageReady && <SettingsStorageNotice />}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState message="دریافت تنظیمات با خطا مواجه شد." />
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <MaintenanceCard initial={data.settings.maintenance} locked={!data.storageReady} />
          <SignupCard initial={data.settings.signup} locked={!data.storageReady} />
          <AnnouncementCard initial={data.settings.announcement} locked={!data.storageReady} />
          <SupportCard initial={data.settings.support} locked={!data.storageReady} />
        </div>
      )}
    </div>
  );
}

/** One settings group: its own local draft and its own save button. */
function useDraft<K extends SiteSettingKey>(key: K, initial: SiteSettings[K]) {
  const [draft, setDraft] = useState(initial);
  const update = useUpdateSiteSetting(key);

  function save() {
    update.mutate(draft, {
      onSuccess: (saved) => {
        setDraft(saved);
        toast.success("تغییرات ذخیره شد.");
      },
      onError: (error) => toast.error(getErrorMessage(error, "ذخیرهٔ تنظیمات با خطا مواجه شد.")),
    });
  }

  return {
    draft,
    patch: (changes: Partial<SiteSettings[K]>) => setDraft((d) => ({ ...d, ...changes })),
    save,
    isSaving: update.isPending,
  };
}

function SettingsCard({
  icon: Icon,
  title,
  description,
  children,
  onSave,
  isSaving,
  locked,
}: {
  icon: typeof Construction;
  title: string;
  description: string;
  children: React.ReactNode;
  onSave: () => void;
  isSaving: boolean;
  locked: boolean;
}) {
  return (
    <Card className="gap-5 py-5">
      <div className="flex items-start gap-3 px-6">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Icon className="size-4" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription className="text-xs leading-5">{description}</CardDescription>
        </div>
      </div>
      <div className="space-y-4 px-6">{children}</div>
      <div className="flex justify-end border-t border-border px-6 pt-4">
        <Button onClick={onSave} disabled={isSaving || locked}>
          {isSaving && <Loader2 className="animate-spin" />}
          ذخیره
        </Button>
      </div>
    </Card>
  );
}

function SwitchRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 px-4 py-3">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function RoleSwitchGroup({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: RoleSwitches;
  disabled?: boolean;
  onChange: (value: RoleSwitches) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {ROLES.map((role) => (
          <label
            key={role}
            className={cn(
              "flex items-center gap-2 rounded-xl border border-border px-3 py-1.5 text-xs",
              disabled && "text-muted-foreground"
            )}
          >
            <Switch
              checked={value[role]}
              disabled={disabled}
              onCheckedChange={(checked) => onChange({ ...value, [role]: checked })}
            />
            {ROLE_LABEL[role]}
          </label>
        ))}
      </div>
    </div>
  );
}

function MaintenanceCard({ initial, locked }: { initial: MaintenanceSettings; locked: boolean }) {
  const { draft, patch, save, isSaving } = useDraft("maintenance", initial);

  return (
    <SettingsCard
      icon={Construction}
      title="حالت تعمیر"
      description="وقتی روشن است، جز مدیران هیچ‌کس نمی‌تواند از پنل استفاده کند و متن زیر را می‌بیند. ورود به حساب باز می‌ماند تا خودتان بتوانید وارد شوید."
      onSave={save}
      isSaving={isSaving}
      locked={locked}
    >
      <SwitchRow
        id="maintenance-enabled"
        label="حالت تعمیر روشن باشد"
        checked={draft.enabled}
        onChange={(enabled) => patch({ enabled })}
      />
      <div className="space-y-2">
        <Label htmlFor="maintenance-message">
          پیام به کاربران <span className="text-muted-foreground">(اختیاری)</span>
        </Label>
        <textarea
          id="maintenance-message"
          rows={3}
          maxLength={1000}
          value={draft.message}
          onChange={(e) => patch({ message: e.target.value })}
          placeholder="مثلاً: در حال به‌روزرسانی سایت هستیم؛ تا ساعت ۱۸ دوباره در دسترس خواهیم بود."
          className={TEXTAREA_CLASS}
        />
      </div>
      {draft.enabled && !initial.enabled && (
        <p className="text-xs text-destructive">
          با ذخیره، همهٔ کاربران غیرمدیر فوراً از پنل بیرون می‌مانند.
        </p>
      )}
    </SettingsCard>
  );
}

function SignupCard({ initial, locked }: { initial: SignupSettings; locked: boolean }) {
  const { draft, patch, save, isSaving } = useDraft("signup", initial);

  return (
    <SettingsCard
      icon={UserPlus}
      title="ثبت‌نام"
      description="ثبت‌نام آزاد از صفحهٔ ورود را باز یا بسته کنید و مشخص کنید کاربر جدید چه نقش‌هایی را می‌تواند انتخاب کند. کسی که لینک دعوت دارد همیشه می‌تواند ثبت‌نام کند."
      onSave={save}
      isSaving={isSaving}
      locked={locked}
    >
      <SwitchRow
        id="signup-open"
        label="ثبت‌نام آزاد باز باشد"
        hint="اگر بسته باشد، فقط با لینک دعوت می‌شود حساب ساخت."
        checked={draft.open}
        onChange={(open) => patch({ open })}
      />
      <RoleSwitchGroup
        label="نقش‌هایی که کاربر جدید می‌تواند انتخاب کند"
        value={draft.roles}
        disabled={!draft.open}
        onChange={(roles) => patch({ roles })}
      />
    </SettingsCard>
  );
}

const TONES: { value: AnnouncementTone; label: string; className: string }[] = [
  { value: "info", label: "اطلاع‌رسانی", className: "data-[active=true]:border-primary data-[active=true]:bg-accent" },
  { value: "warning", label: "هشدار", className: "data-[active=true]:border-warning data-[active=true]:bg-warning-muted" },
  { value: "success", label: "خبر خوب", className: "data-[active=true]:border-success data-[active=true]:bg-success-muted" },
];

function AnnouncementCard({ initial, locked }: { initial: AnnouncementSettings; locked: boolean }) {
  const { draft, patch, save, isSaving } = useDraft("announcement", initial);

  return (
    <SettingsCard
      icon={Megaphone}
      title="اطلاعیهٔ بالای پنل"
      description="یک نوار پیام بالای همهٔ صفحه‌های پنل. کاربر می‌تواند آن را ببندد و تا وقتی متن را عوض نکنید دوباره نمی‌بیند."
      onSave={save}
      isSaving={isSaving}
      locked={locked}
    >
      <SwitchRow
        id="announcement-enabled"
        label="اطلاعیه نمایش داده شود"
        checked={draft.enabled}
        onChange={(enabled) => patch({ enabled })}
      />
      <div className="space-y-2">
        <Label htmlFor="announcement-message">متن اطلاعیه</Label>
        <textarea
          id="announcement-message"
          rows={3}
          maxLength={1000}
          value={draft.message}
          onChange={(e) => patch({ message: e.target.value })}
          placeholder="مثلاً: از اول ماه، اپلیکیشن موبایل جیم‌لیک هم در دسترس است."
          className={TEXTAREA_CLASS}
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">نوع</p>
        <div className="flex flex-wrap gap-2">
          {TONES.map((tone) => (
            <button
              key={tone.value}
              type="button"
              data-active={draft.tone === tone.value}
              onClick={() => patch({ tone: tone.value })}
              className={cn(
                "rounded-xl border border-border px-3 py-1.5 text-xs transition-colors hover:bg-muted",
                tone.className
              )}
            >
              {tone.label}
            </button>
          ))}
        </div>
      </div>
      <RoleSwitchGroup
        label="برای چه کسانی نمایش داده شود"
        value={draft.roles}
        onChange={(roles) => patch({ roles })}
      />
      {draft.enabled && draft.message.trim() === "" && (
        <p className="text-xs text-warning">اطلاعیهٔ بدون متن نمایش داده نمی‌شود.</p>
      )}
    </SettingsCard>
  );
}

function SupportCard({ initial, locked }: { initial: SupportSettings; locked: boolean }) {
  const { draft, patch, save, isSaving } = useDraft("support", initial);

  const fields: {
    key: keyof SupportSettings;
    label: string;
    placeholder: string;
    ltr?: boolean;
    maxLength: number;
  }[] = [
    { key: "phone", label: "تلفن", placeholder: "021-12345678", ltr: true, maxLength: 30 },
    { key: "whatsapp", label: "واتس‌اپ", placeholder: "09121234567", ltr: true, maxLength: 30 },
    { key: "telegram", label: "تلگرام", placeholder: "@gymlic_support", ltr: true, maxLength: 100 },
    { key: "email", label: "ایمیل", placeholder: "support@gymlic-panel.ir", ltr: true, maxLength: 150 },
    { key: "hours", label: "ساعات پاسخگویی", placeholder: "شنبه تا چهارشنبه، ۹ تا ۱۷", maxLength: 200 },
  ];

  return (
    <SettingsCard
      icon={LifeBuoy}
      title="پشتیبانی"
      description="این راه‌های تماس در منوی راهنمای بالای پنل، صفحهٔ حساب مسدود، حالت تعمیر و بخش‌های خاموش نشان داده می‌شوند. هر کدام را خالی بگذارید نمایش داده نمی‌شود."
      onSave={save}
      isSaving={isSaving}
      locked={locked}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div
            key={field.key}
            className={cn("space-y-2", field.key === "hours" && "sm:col-span-2")}
          >
            <Label htmlFor={`support-${field.key}`}>{field.label}</Label>
            <Input
              id={`support-${field.key}`}
              dir={field.ltr ? "ltr" : undefined}
              maxLength={field.maxLength}
              value={draft[field.key]}
              placeholder={field.placeholder}
              onChange={(e) => patch({ [field.key]: e.target.value })}
            />
          </div>
        ))}
      </div>
    </SettingsCard>
  );
}
