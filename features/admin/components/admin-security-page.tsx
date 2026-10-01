"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleCheck,
  Loader2,
  LockKeyhole,
  LockOpen,
  MessageSquareText,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { formatNumber, formatRelativeTime, parseLocaleNumber } from "@/lib/persian";
import { getErrorMessage } from "@/lib/get-error-message";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import {
  confirmTwoFactorSetup,
  getSecurityOverview,
  saveSecurityPolicy,
  startTwoFactorSetup,
  unlockLogin,
  type SecurityOverview,
  type SecurityPolicy,
} from "../services/admin-security-service";
import { parseSqlDate } from "../utils/format";

const QUERY_KEY = ["admin", "security"] as const;

export function AdminSecurityPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: QUERY_KEY, queryFn: getSecurityOverview });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">امنیت ورود</h1>
        <p className="text-sm text-muted-foreground">
          قفل موقت بعد از ورودهای ناموفق، ورود دومرحله‌ای برای مدیران، و حساب‌هایی که الان قفل
          شده‌اند.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : isError || !data ? (
        <ErrorState message="دریافت وضعیت امنیت با خطا مواجه شد." />
      ) : !data.ready ? (
        <Card className="py-8">
          <div className="px-6">
            <EmptyState
              icon={ShieldAlert}
              title="قفل ورود و ورود دومرحله‌ای هنوز فعال نیست."
              description="به‌روزرسانی «نقش‌های مدیریتی، قفل ورود و ورود دومرحله‌ای (فاز ۵)» را از صفحهٔ «به‌روزرسانی دیتابیس» اجرا کنید."
            />
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <TwoFactorCard data={data} onChanged={refresh} />
            <LockoutCard key={JSON.stringify(data.settings)} policy={data.settings} onSaved={refresh} />
          </div>
          <LocksCard data={data} onChanged={refresh} />
          <FailuresCard data={data} />
        </>
      )}
    </div>
  );
}

function TwoFactorCard({ data, onChanged }: { data: SecurityOverview; onChanged: () => void }) {
  const [starting, setStarting] = useState(false);
  const [challenge, setChallenge] = useState<{ id: string; phoneHint: string } | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);
  const enabled = data.settings.admin_2fa;
  const blockers: string[] = [];
  if (!data.sms_ready) blockers.push("پیامک تنظیم نشده است (تنظیمات سایت ← پیامک و ایمیل).");
  if (data.admins_without_phone.length > 0) {
    blockers.push(
      `این مدیران شمارهٔ موبایل معتبر ندارند: ${data.admins_without_phone.map((a) => a.name).join("، ")}.`
    );
  }

  async function start() {
    setStarting(true);
    try {
      const result = await startTwoFactorSetup();
      setChallenge({ id: result.challenge_id, phoneHint: result.phone_hint });
    } catch (error) {
      toast.error(getErrorMessage(error, "ارسال کد ناموفق بود."));
    } finally {
      setStarting(false);
    }
  }

  return (
    <Card className="gap-4 py-5">
      <div className="flex items-start gap-3 px-6">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <MessageSquareText className="size-4" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-base">ورود دومرحله‌ای مدیران</CardTitle>
          <CardDescription className="text-xs leading-5">
            وقتی روشن است، هر مدیر (کل یا با نقش محدود) بعد از رمز، یک کد ۶ رقمی پیامکی هم وارد
            می‌کند. اگر رمز یک مدیر لو برود، بدون گوشی‌اش نمی‌شود وارد پنل شد. کاربران عادی تغییری
            نمی‌بینند.
          </CardDescription>
        </div>
      </div>
      <div className="space-y-3 px-6">
        <div
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
            enabled ? "bg-success-muted text-success" : "bg-muted text-muted-foreground"
          }`}
        >
          {enabled ? <ShieldCheck className="size-4" /> : <ShieldAlert className="size-4" />}
          {enabled ? "روشن است." : "خاموش است."}
        </div>

        {enabled ? (
          <Button variant="outline" className="w-full" onClick={() => setConfirmOff(true)}>
            خاموش‌کردن ورود دومرحله‌ای
          </Button>
        ) : (
          <>
            {blockers.length > 0 && (
              <div className="space-y-1 rounded-xl bg-warning-muted px-4 py-3 text-xs leading-5 text-warning">
                <p className="flex items-center gap-1.5 font-medium">
                  <TriangleAlert className="size-4" />
                  پیش از روشن‌کردن:
                </p>
                {blockers.map((b) => (
                  <p key={b}>• {b}</p>
                ))}
              </div>
            )}
            <Button className="w-full" onClick={start} disabled={starting || blockers.length > 0}>
              {starting && <Loader2 className="animate-spin" />}
              روشن‌کردن — ارسال کد آزمایشی به{" "}
              {data.my_phone_hint ? <span dir="ltr">{data.my_phone_hint}</span> : "گوشی من"}
            </Button>
            <p className="text-xs leading-5 text-muted-foreground">
              برای اینکه خودتان پشت در نمانید، اول یک کد به گوشی خودتان فرستاده می‌شود و فقط بعد از
              واردکردن درستش روشن می‌شود. اگر روزی پیامک از کار افتاد و نتوانستید وارد شوید، در
              phpMyAdmin ردیف <code dir="ltr">security</code> جدول{" "}
              <code dir="ltr">app_settings</code> را حذف کنید تا خاموش شود.
            </p>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmOff}
        onOpenChange={setConfirmOff}
        title="خاموش‌کردن ورود دومرحله‌ای"
        description="مدیران از این به بعد فقط با رمز وارد می‌شوند."
        confirmLabel="خاموش کن"
        errorMessage="خاموش‌کردن ناموفق بود."
        onConfirm={async () => {
          await saveSecurityPolicy({ ...data.settings, admin_2fa: false });
          toast.success("ورود دومرحله‌ای خاموش شد.");
          onChanged();
        }}
      />
      <ConfirmCodeDialog
        challenge={challenge}
        onClose={() => setChallenge(null)}
        onConfirmed={() => {
          setChallenge(null);
          toast.success("ورود دومرحله‌ای روشن شد.");
          onChanged();
        }}
      />
    </Card>
  );
}

function ConfirmCodeDialog({
  challenge,
  onClose,
  onConfirmed,
}: {
  challenge: { id: string; phoneHint: string } | null;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  async function confirm() {
    if (!challenge || !code.trim()) return;
    setSaving(true);
    try {
      await confirmTwoFactorSetup(challenge.id, code);
      setCode("");
      onConfirmed();
    } catch (error) {
      toast.error(getErrorMessage(error, "کد درست نیست."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!challenge} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>کد تأیید</DialogTitle>
          <DialogDescription>
            کدی را که به{" "}
            <span dir="ltr" className="font-medium">
              {challenge?.phoneHint}
            </span>{" "}
            پیامک شد وارد کنید. با تأیید آن، ورود دومرحله‌ای برای همهٔ مدیران روشن می‌شود.
          </DialogDescription>
        </DialogHeader>
        <Input
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="------"
          className="text-center text-lg tracking-[0.5em]"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
          aria-label="کد تأیید"
        />
        <DialogFooter>
          <Button onClick={confirm} disabled={saving || !code.trim()}>
            {saving && <Loader2 className="animate-spin" />}
            تأیید و روشن‌کردن
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LockoutCard({ policy, onSaved }: { policy: SecurityPolicy; onSaved: () => void }) {
  const [values, setValues] = useState({
    max_attempts: String(policy.max_attempts),
    lock_minutes: String(policy.lock_minutes),
    ip_max_attempts: String(policy.ip_max_attempts),
  });
  const [saving, setSaving] = useState(false);

  const fields: { key: keyof typeof values; label: string; hint: string; min: number; max: number }[] = [
    { key: "max_attempts", label: "تلاش ناموفق مجاز برای هر حساب", hint: "بعد از این تعداد، آن حساب قفل می‌شود.", min: 3, max: 20 },
    { key: "lock_minutes", label: "مدت قفل (دقیقه)", hint: "تلاش‌های همین بازه شمرده می‌شوند.", min: 1, max: 1440 },
    { key: "ip_max_attempts", label: "تلاش ناموفق مجاز از یک IP", hint: "جلوی کسی را می‌گیرد که رمز حساب‌های مختلف را امتحان می‌کند.", min: 10, max: 1000 },
  ];

  async function save() {
    const parsed: Partial<SecurityPolicy> = {};
    for (const field of fields) {
      const value = parseLocaleNumber(values[field.key]);
      if (value === null || !Number.isInteger(value) || value < field.min || value > field.max) {
        toast.error(`«${field.label}» باید عددی بین ${formatNumber(field.min)} و ${formatNumber(field.max)} باشد.`);
        return;
      }
      parsed[field.key] = value;
    }
    setSaving(true);
    try {
      await saveSecurityPolicy({ ...policy, ...parsed });
      toast.success("ذخیره شد.");
      onSaved();
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیره ناموفق بود."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="gap-4 py-5">
      <div className="flex items-start gap-3 px-6">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <LockKeyhole className="size-4" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-base">قفل موقت بعد از ورود ناموفق</CardTitle>
          <CardDescription className="text-xs leading-5">
            برای همهٔ کاربران. جلوی حدس‌زدن رمز را می‌گیرد؛ بعد از پایان مدت قفل، یا با ورود موفق، شمارش
            از صفر شروع می‌شود.
          </CardDescription>
        </div>
      </div>
      <div className="space-y-3 px-6">
        {fields.map((field) => (
          <div key={field.key} className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor={`policy-${field.key}`}>{field.label}</Label>
              <p className="text-xs text-muted-foreground">{field.hint}</p>
            </div>
            <Input
              id={`policy-${field.key}`}
              dir="ltr"
              inputMode="numeric"
              className="w-20 text-center"
              value={values[field.key]}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end border-t border-border px-6 pt-4">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          ذخیره
        </Button>
      </div>
    </Card>
  );
}

function LocksCard({ data, onChanged }: { data: SecurityOverview; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const locks = [
    ...data.locked.emails.map((l) => ({ key: `e:${l.email}`, label: l.email, kind: "حساب", target: { email: l.email }, ...l })),
    ...data.locked.ips.map((l) => ({ key: `i:${l.ip}`, label: l.ip, kind: "IP", target: { ip: l.ip }, ...l })),
  ];

  async function unlock(key: string, target: { email: string } | { ip: string }) {
    setBusy(key);
    try {
      await unlockLogin(target);
      toast.success("قفل باز شد.");
      onChanged();
    } catch (error) {
      toast.error(getErrorMessage(error, "باز کردن قفل ناموفق بود."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="gap-3 py-5">
      <div className="px-6">
        <CardTitle className="text-base">قفل‌های فعلی ({formatNumber(locks.length)})</CardTitle>
        <CardDescription className="text-xs">
          اگر کاربری که رمزش را چند بار اشتباه زده با شما تماس گرفت، این‌جا قفلش را زودتر باز کنید.
        </CardDescription>
      </div>
      {locks.length === 0 ? (
        <p className="flex items-center gap-2 px-6 text-sm text-muted-foreground">
          <CircleCheck className="size-4 text-success" />
          هیچ حساب یا IPای قفل نیست.
        </p>
      ) : (
        <div className="space-y-2 px-6">
          {locks.map((lock) => (
            <div key={lock.key} className="flex items-center gap-3 rounded-xl border border-border p-3">
              <Badge variant="outline">{lock.kind}</Badge>
              <span dir="ltr" className="min-w-0 flex-1 truncate text-right text-sm">
                {lock.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatNumber(lock.failures)} تلاش · {formatNumber(lock.minutes_left)} دقیقه مانده
              </span>
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => unlock(lock.key, lock.target)}>
                {busy === lock.key ? <Loader2 className="animate-spin" /> : <LockOpen />}
                باز کردن
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function FailuresCard({ data }: { data: SecurityOverview }) {
  return (
    <Card className="gap-3 py-5">
      <div className="px-6">
        <CardTitle className="text-base">آخرین ورودهای ناموفق</CardTitle>
        <CardDescription className="text-xs">
          ۱۰۰ مورد آخر. تعداد زیاد از یک IP یعنی کسی دارد رمز حدس می‌زند.
        </CardDescription>
      </div>
      {data.recent_failures.length === 0 ? (
        <p className="px-6 text-sm text-muted-foreground">ورود ناموفقی ثبت نشده است.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ایمیل</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>زمان</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.recent_failures.map((row, index) => (
              <TableRow key={`${row.email}-${row.created_at}-${index}`}>
                <TableCell dir="ltr" className="text-right text-sm">
                  {row.email}
                </TableCell>
                <TableCell dir="ltr" className="text-right text-xs text-muted-foreground">
                  {row.ip_address ?? "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatRelativeTime(parseSqlDate(row.created_at))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
