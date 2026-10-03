"use client";

import { useState } from "react";
import {
  Construction,
  Gauge,
  LifeBuoy,
  Loader2,
  Mail,
  Megaphone,
  MessageSquareText,
  Send,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROLE_LABEL } from "@/components/layout/sidebar-nav";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber, parseLocaleNumber } from "@/lib/persian";
import {
  sendTestMail,
  sendTestSms,
  sendTestTelegram,
  useAdminSiteSettings,
  useUpdateSiteSetting,
  type AdminSettingKey,
  type AdminSiteSettings,
  type AnnouncementSettings,
  type AnnouncementTone,
  type AttachmentType,
  type DeliveryStatus,
  type LimitsSettings,
  type MailSettings,
  type MaintenanceSettings,
  type RoleSwitches,
  type SignupSettings,
  type SmsSettings,
  type SupportSettings,
  type TelegramSettings,
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
          هر کارت جداگانه ذخیره می‌شود و تغییر بلافاصله روی سایت اعمال می‌شود؛ نیازی به آپلود دوباره
          نیست.
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
        <Tabs defaultValue="general" className="space-y-4">
          <TabsList>
            <TabsTrigger value="general">عمومی</TabsTrigger>
            <TabsTrigger value="limits">محدودیت‌ها</TabsTrigger>
            {/* Credentials: only a super admin gets them from the API at all. */}
            {data.settings.sms && data.settings.mail && (
              <TabsTrigger value="delivery">پیامک، ایمیل و تلگرام</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="general">
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              <MaintenanceCard initial={data.settings.maintenance} locked={!data.storageReady} />
              <SignupCard initial={data.settings.signup} locked={!data.storageReady} />
              <AnnouncementCard initial={data.settings.announcement} locked={!data.storageReady} />
              <SupportCard initial={data.settings.support} locked={!data.storageReady} />
            </div>
          </TabsContent>
          <TabsContent value="limits">
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              <LimitsCard
                initial={data.settings.limits}
                server={data.server}
                locked={!data.storageReady}
              />
            </div>
          </TabsContent>
          {data.settings.sms && data.settings.mail && (
            <TabsContent value="delivery">
              <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                <SmsCard
                  initial={data.settings.sms}
                  delivery={data.delivery}
                  locked={!data.storageReady}
                />
                <MailCard
                  initial={data.settings.mail}
                  delivery={data.delivery}
                  locked={!data.storageReady}
                />
                {data.settings.telegram && (
                  <TelegramCard initial={data.settings.telegram} locked={!data.storageReady} />
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}

type AdminValues = AdminSiteSettings["settings"];

/** One settings group: its own local draft and its own save button. */
function useDraft<K extends AdminSettingKey>(key: K, initial: AdminValues[K]) {
  const [draft, setDraft] = useState(initial);
  const update = useUpdateSiteSetting(key);

  /**
   * overrides: fields parsed at save time. They go in with this save rather
   * than through patch(), whose update the current draft hasn't seen yet.
   */
  function save(
    options: { clearSecrets?: string[]; overrides?: Partial<AdminValues[K]> } = {}
  ) {
    update.mutate(
      { value: { ...draft, ...options.overrides }, clearSecrets: options.clearSecrets ?? [] },
      {
        onSuccess: (saved) => {
          setDraft(saved);
          toast.success("تغییرات ذخیره شد.");
        },
        onError: (error) => toast.error(getErrorMessage(error, "ذخیرهٔ تنظیمات با خطا مواجه شد.")),
      }
    );
  }

  return {
    draft,
    patch: (changes: Partial<AdminValues[K]>) => setDraft((d) => ({ ...d, ...changes })),
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
  actions,
  isSaving,
  locked,
}: {
  icon: typeof Construction;
  title: string;
  description: string;
  children: React.ReactNode;
  onSave: () => void;
  /** Extra buttons beside Save (e.g. a test send). */
  actions?: React.ReactNode;
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
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 pt-4">
        {actions}
        <Button onClick={() => onSave()} disabled={isSaving || locked}>
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
      onSave={() => save()}
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
      onSave={() => save()}
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
      onSave={() => save()}
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
      onSave={() => save()}
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

const ATTACHMENTS: { type: AttachmentType; label: string }[] = [
  { type: "image", label: "عکس" },
  { type: "video", label: "ویدیو" },
  { type: "voice", label: "پیام صوتی" },
  { type: "file", label: "فایل (PDF و Word)" },
];

function LimitsCard({
  initial,
  server,
  locked,
}: {
  initial: LimitsSettings;
  server: AdminSiteSettings["server"];
  locked: boolean;
}) {
  const { draft, patch, save, isSaving } = useDraft("limits", initial);
  const [maxChars, setMaxChars] = useState(String(initial.message_max_chars));
  const [sizes, setSizes] = useState<Record<AttachmentType, string>>(() => ({
    voice: String(initial.upload_mb.voice),
    image: String(initial.upload_mb.image),
    video: String(initial.upload_mb.video),
    file: String(initial.upload_mb.file),
  }));
  // PHP refuses anything past the smaller of these before our code runs.
  const hostCeiling =
    server?.upload_max_mb != null && server.post_max_mb != null
      ? Math.min(server.upload_max_mb, server.post_max_mb)
      : (server?.upload_max_mb ?? null);

  function submit() {
    const chars = parseLocaleNumber(maxChars);
    if (chars === null || !Number.isInteger(chars) || chars < 50 || chars > 1000) {
      toast.error("سقف طول پیام باید عددی بین ۵۰ و ۱۰۰۰ باشد.");
      return;
    }
    const uploadMb = { ...draft.upload_mb };
    for (const { type, label } of ATTACHMENTS) {
      const mb = parseLocaleNumber(sizes[type]);
      if (mb === null || !Number.isInteger(mb) || mb < 1 || mb > 200) {
        toast.error(`حجم ${label} باید عددی بین ۱ و ۲۰۰ مگابایت باشد.`);
        return;
      }
      uploadMb[type] = mb;
    }
    save({ overrides: { message_max_chars: chars, upload_mb: uploadMb } });
  }

  return (
    <SettingsCard
      icon={Gauge}
      title="پیام‌ها و فایل‌ها"
      description="سقف طول پیام، نوع پیوست‌هایی که مربی و ورزشکار می‌توانند در پیام‌ها بفرستند، و حداکثر حجم هر نوع."
      onSave={submit}
      isSaving={isSaving}
      locked={locked}
    >
      <div className="space-y-2">
        <Label htmlFor="limits-chars">سقف طول هر پیام (حرف)</Label>
        <Input
          id="limits-chars"
          dir="ltr"
          inputMode="numeric"
          className="w-32 text-center"
          value={maxChars}
          onChange={(e) => setMaxChars(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          بین ۵۰ و ۱۰۰۰؛ بیشتر از ۱۰۰۰ جا در دیتابیس ندارد.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">پیوست‌ها</p>
        {ATTACHMENTS.map(({ type, label }) => (
          <div
            key={type}
            className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-2.5"
          >
            <label className="flex items-center gap-3 text-sm">
              <Switch
                checked={draft.attachments[type]}
                onCheckedChange={(checked) =>
                  patch({ attachments: { ...draft.attachments, [type]: checked } })
                }
              />
              {label}
            </label>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              تا
              <Input
                dir="ltr"
                inputMode="numeric"
                className="h-8 w-16 text-center"
                disabled={!draft.attachments[type]}
                value={sizes[type]}
                onChange={(e) => setSizes((s) => ({ ...s, [type]: e.target.value }))}
                aria-label={`حداکثر حجم ${label}`}
              />
              مگابایت
            </div>
          </div>
        ))}
        {hostCeiling !== null && (
          <p className="text-xs text-muted-foreground">
            سقف آپلود خود هاست {formatNumber(hostCeiling)} مگابایت است؛ عدد بزرگ‌تر از آن اثری
            ندارد و باید از پنل هاست (تنظیمات PHP) بالا برود.
          </p>
        )}
      </div>
    </SettingsCard>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  panel: "از همین پنل",
  config: "از فایل config.php",
  none: "تنظیم نشده",
  "mail()": "تابع mail() هاست (بدون SMTP)",
};

function SourceNote({ label, source }: { label: string; source: string | undefined }) {
  if (!source) return null;
  return (
    <p className="text-xs text-muted-foreground">
      {label}: <span className="font-medium text-foreground">{SOURCE_LABEL[source] ?? source}</span>
    </p>
  );
}

/**
 * A credential input: the stored value never comes back from the API, so
 * the field starts empty and "empty" means "keep what is saved".
 */
function SecretInput({
  id,
  label,
  isSet,
  hint,
  value,
  cleared,
  onChange,
  onClear,
}: {
  id: string;
  label: string;
  isSet: boolean;
  hint: string;
  value: string;
  cleared: boolean;
  onChange: (value: string) => void;
  onClear: (cleared: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        dir="ltr"
        type="password"
        autoComplete="new-password"
        value={value}
        disabled={cleared}
        placeholder={isSet ? `ذخیره شده (${hint}) — برای تغییر، مقدار جدید را وارد کنید` : ""}
        onChange={(e) => onChange(e.target.value)}
      />
      {isSet && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={cleared} onChange={(e) => onClear(e.target.checked)} />
          پاک‌کردن مقدار ذخیره‌شده در پنل
        </label>
      )}
    </div>
  );
}

function TestSend({
  label,
  placeholder,
  send,
}: {
  label: string;
  placeholder: string;
  send: (target: string) => Promise<void>;
}) {
  const [target, setTarget] = useState("");
  const [sending, setSending] = useState(false);

  async function run() {
    if (!target.trim()) {
      toast.error("مقصد ارسال آزمایشی را وارد کنید.");
      return;
    }
    setSending(true);
    try {
      await send(target.trim());
      toast.success("ارسال شد. مقصد را بررسی کنید.");
    } catch (error) {
      toast.error(getErrorMessage(error, "ارسال آزمایشی ناموفق بود."));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-1 items-center gap-2">
      <Input
        dir="ltr"
        value={target}
        placeholder={placeholder}
        onChange={(e) => setTarget(e.target.value)}
        className="min-w-0"
        aria-label={label}
      />
      <Button variant="outline" onClick={run} disabled={sending}>
        {sending && <Loader2 className="animate-spin" />}
        {label}
      </Button>
    </div>
  );
}

function SmsCard({
  initial,
  delivery,
  locked,
}: {
  initial: SmsSettings;
  delivery: DeliveryStatus | null;
  locked: boolean;
}) {
  const { draft, patch, save, isSaving } = useDraft("sms", initial);
  const [clearKey, setClearKey] = useState(false);

  return (
    <SettingsCard
      icon={MessageSquareText}
      title="پیامک (ملی‌پیامک)"
      description="توکن کنسول ملی‌پیامک و شماره‌ی خط ارسال. هر فیلدی خالی بماند، مقدار فایل config.php استفاده می‌شود. توکن ذخیره‌شده هیچ‌وقت کامل نمایش داده نمی‌شود."
      onSave={() => {
        save({ clearSecrets: clearKey ? ["api_key"] : [] });
        setClearKey(false);
      }}
      isSaving={isSaving}
      locked={locked}
      actions={<TestSend label="پیامک آزمایشی" placeholder="09121234567" send={sendTestSms} />}
    >
      <SecretInput
        id="sms-api-key"
        label="توکن API"
        isSet={!!draft.api_key_set}
        hint={draft.api_key_hint ?? ""}
        value={draft.api_key}
        cleared={clearKey}
        onChange={(api_key) => patch({ api_key })}
        onClear={setClearKey}
      />
      <div className="space-y-2">
        <Label htmlFor="sms-sender">شماره‌ی خط ارسال</Label>
        <Input
          id="sms-sender"
          dir="ltr"
          value={draft.sender}
          placeholder="50004001234567"
          onChange={(e) => patch({ sender: e.target.value })}
        />
      </div>
      <div className="space-y-1 rounded-xl bg-muted/50 px-4 py-3">
        <SourceNote label="توکن در حال استفاده" source={delivery?.sms_api_key} />
        <SourceNote label="خط در حال استفاده" source={delivery?.sms_sender} />
        <p className="text-xs text-muted-foreground">
          پیش از ارسال آزمایشی، تغییرات را ذخیره کنید.
        </p>
      </div>
    </SettingsCard>
  );
}

function TelegramCard({ initial, locked }: { initial: TelegramSettings; locked: boolean }) {
  const { draft, patch, save, isSaving } = useDraft("telegram", initial);
  const [clearToken, setClearToken] = useState(false);
  const [sending, setSending] = useState(false);

  async function test() {
    setSending(true);
    try {
      await sendTestTelegram();
      toast.success("ارسال شد. ربات تلگرام را بررسی کنید.");
    } catch (error) {
      toast.error(getErrorMessage(error, "ارسال آزمایشی ناموفق بود."));
    } finally {
      setSending(false);
    }
  }

  return (
    <SettingsCard
      icon={Send}
      title="ربات تلگرام"
      description="اعلان رویدادهای سایت (پرداخت، تیکت، خطا) برای مدیر. توکن را از BotFather بگیرید. توکن ذخیره‌شده هیچ‌وقت کامل نمایش داده نمی‌شود."
      onSave={() => {
        save({ clearSecrets: clearToken ? ["bot_token"] : [] });
        setClearToken(false);
      }}
      isSaving={isSaving}
      locked={locked}
      actions={
        <Button variant="outline" onClick={test} disabled={sending}>
          {sending && <Loader2 className="animate-spin" />}
          پیام آزمایشی تلگرام
        </Button>
      }
    >
      <SecretInput
        id="telegram-bot-token"
        label="توکن ربات"
        isSet={!!draft.bot_token_set}
        hint={draft.bot_token_hint ?? ""}
        value={draft.bot_token}
        cleared={clearToken}
        onChange={(bot_token) => patch({ bot_token })}
        onClear={setClearToken}
      />
      <div className="space-y-2">
        <Label htmlFor="telegram-chat-id">شناسه‌ی چت</Label>
        <Input
          id="telegram-chat-id"
          dir="ltr"
          value={draft.chat_id}
          placeholder="123456789"
          onChange={(e) => patch({ chat_id: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="telegram-api-base">آدرس واسط (اختیاری)</Label>
        <Input
          id="telegram-api-base"
          dir="ltr"
          value={draft.api_base}
          placeholder="https://relay.example.com"
          onChange={(e) => patch({ api_base: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          فقط اگر هاست به تلگرام وصل نمی‌شود: آدرس https یک سرور واسط خارج از ایران. خالی = اتصال مستقیم.
        </p>
      </div>
      <p className="rounded-xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
        پیش از ارسال آزمایشی، تغییرات را ذخیره کنید.
      </p>
    </SettingsCard>
  );
}

function MailCard({
  initial,
  delivery,
  locked,
}: {
  initial: MailSettings;
  delivery: DeliveryStatus | null;
  locked: boolean;
}) {
  const { draft, patch, save, isSaving } = useDraft("mail", initial);
  const [clearPass, setClearPass] = useState(false);
  const [port, setPort] = useState(String(initial.smtp_port));

  return (
    <SettingsCard
      icon={Mail}
      title="ایمیل"
      description="فرستنده‌ی ایمیل‌ها و سرور SMTP. اگر میزبان SMTP این‌جا خالی باشد، تنظیمات SMTP فایل config.php (یا در نبودِ آن، تابع mail() هاست) استفاده می‌شود."
      onSave={() => {
        const parsedPort = parseLocaleNumber(port);
        if (parsedPort === null || !Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
          toast.error("پورت SMTP معتبر نیست.");
          return;
        }
        save({
          clearSecrets: clearPass ? ["smtp_pass"] : [],
          overrides: { smtp_port: parsedPort },
        });
        setClearPass(false);
      }}
      isSaving={isSaving}
      locked={locked}
      actions={<TestSend label="ایمیل آزمایشی" placeholder="you@example.com" send={sendTestMail} />}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="mail-from-address">آدرس فرستنده</Label>
          <Input
            id="mail-from-address"
            dir="ltr"
            value={draft.from_address}
            placeholder="no-reply@gymlic-panel.ir"
            onChange={(e) => patch({ from_address: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mail-from-name">نام فرستنده</Label>
          <Input
            id="mail-from-name"
            value={draft.from_name}
            placeholder="جیم‌لیک"
            onChange={(e) => patch({ from_name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mail-host">میزبان SMTP</Label>
          <Input
            id="mail-host"
            dir="ltr"
            value={draft.smtp_host}
            placeholder="mail.gymlic-panel.ir"
            onChange={(e) => patch({ smtp_host: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="mail-port">پورت</Label>
            <Input
              id="mail-port"
              dir="ltr"
              inputMode="numeric"
              value={port}
              onChange={(e) => setPort(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>رمزنگاری</Label>
            <div className="flex gap-1">
              {(["ssl", "tls"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  data-active={draft.smtp_secure === mode}
                  onClick={() => {
                    patch({ smtp_secure: mode });
                    setPort(mode === "ssl" ? "465" : "587");
                  }}
                  className="h-10 flex-1 rounded-xl border border-border text-xs uppercase data-[active=true]:border-primary data-[active=true]:bg-accent"
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mail-user">نام کاربری SMTP</Label>
          <Input
            id="mail-user"
            dir="ltr"
            autoComplete="off"
            value={draft.smtp_user}
            onChange={(e) => patch({ smtp_user: e.target.value })}
          />
        </div>
        <SecretInput
          id="mail-pass"
          label="رمز SMTP"
          isSet={!!draft.smtp_pass_set}
          hint={draft.smtp_pass_hint ?? ""}
          value={draft.smtp_pass}
          cleared={clearPass}
          onChange={(smtp_pass) => patch({ smtp_pass })}
          onClear={setClearPass}
        />
      </div>
      <div className="space-y-1 rounded-xl bg-muted/50 px-4 py-3">
        <SourceNote label="روش ارسال در حال استفاده" source={delivery?.mail} />
        <p className="text-xs text-muted-foreground">
          پیش از ارسال آزمایشی، تغییرات را ذخیره کنید.
        </p>
      </div>
    </SettingsCard>
  );
}
