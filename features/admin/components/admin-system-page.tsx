"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CircleCheck,
  Clock,
  Database,
  Download,
  FolderOpen,
  Loader2,
  RefreshCw,
  Server,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/persian";
import { getErrorMessage } from "@/lib/get-error-message";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import {
  downloadBackup,
  getSystemHealth,
  type CronStatus,
  type SystemHealth,
} from "../services/admin-system-service";
import { formatBytes, formatMinutesAgo, parseSqlDate } from "../utils/format";
import { useIsSuperAdmin } from "../hooks/use-admin-access";

const CRON_STATE: Record<CronStatus["state"], { label: string; variant: "success" | "destructive" | "warning" }> = {
  ok: { label: "سالم", variant: "success" },
  stalled: { label: "متوقف شده", variant: "destructive" },
  never: { label: "هنوز گزارشی نداده", variant: "warning" },
};

function intervalLabel(minutes: number): string {
  return minutes >= 1440 ? "روزی یک بار" : `هر ${formatNumber(minutes)} دقیقه`;
}

export function AdminSystemPage() {
  // The backup holds every password hash and key: super admin only.
  const isSuper = useIsSuperAdmin();
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin", "system", "health"],
    queryFn: getSystemHealth,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">سلامت سایت</h1>
          <p className="text-sm text-muted-foreground">
            وضعیت کارهای زمان‌بندی‌شده (کران‌جاب‌ها)، دیتابیس، هاست و فایل‌های آپلودی، و گرفتن نسخهٔ
            پشتیبان.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn(isFetching && "animate-spin")} />
          بررسی دوباره
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState message="دریافت وضعیت سایت با خطا مواجه شد." />
      ) : (
        <>
          <CronsCard crons={data.crons} />
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <DatabaseCard health={data} />
            <HostCard health={data} />
            <UploadsCard health={data} />
            {isSuper && <BackupCard />}
          </div>
        </>
      )}
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Server;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-4 py-5">
      <div className="flex items-start gap-3 px-6">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Icon className="size-4" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription className="text-xs leading-5">{description}</CardDescription>}
        </div>
      </div>
      <div className="space-y-3 px-6">{children}</div>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2 text-sm last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{children}</span>
    </div>
  );
}

function CronsCard({ crons }: { crons: CronStatus[] }) {
  const problems = crons.filter((cron) => cron.state !== "ok").length;

  return (
    <InfoCard
      icon={Clock}
      title="کارهای زمان‌بندی‌شده (کران‌جاب)"
      description="ارسال پیامک و ایمیل، یادآورها و اعلان مرورگر را این‌ها انجام می‌دهند. اگر یکی متوقف شود، آن کار بی‌صدا انجام نمی‌شود — این‌جا تنها جایی است که معلوم می‌شود."
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl px-4 py-3 text-sm",
          problems === 0 ? "bg-success-muted text-success" : "bg-warning-muted text-warning"
        )}
      >
        {problems === 0 ? <CircleCheck className="size-4" /> : <TriangleAlert className="size-4" />}
        {problems === 0
          ? "همهٔ کران‌جاب‌ها به‌موقع اجرا می‌شوند."
          : `${formatNumber(problems)} کران‌جاب مشکل دارد.`}
      </div>

      <div className="space-y-2">
        {crons.map((cron) => {
          const state = CRON_STATE[cron.state];
          return (
            <div
              key={cron.name}
              className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{cron.label}</p>
                <p dir="ltr" className="text-right text-[11px] text-muted-foreground">
                  cron/{cron.name}.php
                </p>
              </div>
              <div className="text-xs text-muted-foreground sm:w-48">
                <p>باید {intervalLabel(cron.interval_minutes)} اجرا شود</p>
                <p>
                  آخرین اجرا:{" "}
                  {cron.minutes_ago !== null ? formatMinutesAgo(cron.minutes_ago) : "هیچ‌وقت"}
                </p>
              </div>
              <Badge variant={state.variant}>{state.label}</Badge>
            </div>
          );
        })}
      </div>

      {problems > 0 && (
        <div className="space-y-1 rounded-xl bg-muted/60 px-4 py-3 text-xs leading-6 text-muted-foreground">
          <p className="font-medium text-foreground">چطور درستش کنم؟</p>
          <p>
            در پنل هاست (cPanel → Cron Jobs یا DirectAdmin → Cronjobs) برای هر مورد یک کران با همان
            فاصلهٔ زمانی بسازید که این دستور را اجرا کند (مسیر را با مسیر واقعی پوشهٔ بک‌اند روی
            هاستتان عوض کنید):
          </p>
          <pre dir="ltr" className="overflow-x-auto rounded-lg bg-background p-2 text-left text-[11px]">
            {crons
              .filter((cron) => cron.state !== "ok")
              .map((cron) => `php /home/USER/backend-php/cron/${cron.name}.php`)
              .join("\n")}
          </pre>
          <p>
            «هنوز گزارشی نداده» بعد از اولین آپلود این نسخه طبیعی است تا اولین اجرای بعدی (حداکثر چند
            دقیقه، و برای یادآور ارزیابی تا یک روز).
          </p>
        </div>
      )}
    </InfoCard>
  );
}

function DatabaseCard({ health }: { health: SystemHealth }) {
  const { database, php } = health;
  // Both clocks are read on the server, so this compares PHP with MySQL only.
  const skewMinutes = Math.abs(
    (parseSqlDate(php.now).getTime() - parseSqlDate(database.now).getTime()) / 60_000
  );

  return (
    <InfoCard icon={Database} title="دیتابیس">
      <Row label="نسخه">
        <span dir="ltr">{database.version}</span>
      </Row>
      <Row label="حجم کل">{formatBytes(database.size_bytes)}</Row>
      <Row label="تعداد جدول‌ها">{formatNumber(database.tables)}</Row>
      {skewMinutes > 5 && (
        <p className="rounded-xl bg-warning-muted px-3 py-2 text-xs text-warning">
          ساعت PHP و دیتابیس {formatNumber(Math.round(skewMinutes))} دقیقه با هم فرق دارند (احتمالاً
          منطقهٔ زمانی متفاوت). زمان یادآورها ممکن است جابه‌جا شود.
        </p>
      )}
      <div className="space-y-1.5 pt-1">
        <p className="text-xs font-medium text-foreground">بزرگ‌ترین جدول‌ها</p>
        {database.largest.map((table) => (
          <div key={table.name} className="flex items-center justify-between text-xs text-muted-foreground">
            <span dir="ltr">{table.name}</span>
            <span>
              حدود {formatNumber(table.approx_rows)} ردیف · {formatBytes(table.size_bytes)}
            </span>
          </div>
        ))}
      </div>
    </InfoCard>
  );
}

const EXTENSION_PURPOSE: Record<string, string> = {
  pdo_mysql: "اتصال به دیتابیس",
  mbstring: "متن فارسی",
  curl: "ارسال پیامک و اعلان مرورگر",
  gd: "عکس پروفایل و لوگو",
  fileinfo: "تشخیص نوع فایل‌های پیام",
  openssl: "اعلان مرورگر و ایمیل امن",
  zlib: "فشرده‌سازی نسخهٔ پشتیبان",
};

function HostCard({ health }: { health: SystemHealth }) {
  const { php } = health;
  return (
    <InfoCard icon={Server} title="هاست و PHP">
      <Row label="نسخهٔ PHP">
        <span dir="ltr">{php.version}</span>
      </Row>
      <Row label="سقف حجم آپلود">
        <span dir="ltr">
          {php.upload_max_size} / post {php.post_max_size}
        </span>
      </Row>
      <Row label="حافظه">
        <span dir="ltr">{php.memory_limit === "-1" ? "نامحدود" : php.memory_limit}</span>
      </Row>
      <Row label="حداکثر زمان اجرا">
        {php.max_execution_time === 0 ? "نامحدود" : `${formatNumber(php.max_execution_time)} ثانیه`}
      </Row>
      <Row label="منطقهٔ زمانی">
        <span dir="ltr">{php.timezone}</span>
      </Row>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {Object.entries(php.extensions).map(([name, loaded]) => (
          <Badge
            key={name}
            variant={loaded ? "secondary" : "destructive"}
            title={EXTENSION_PURPOSE[name]}
          >
            {loaded ? "✓" : "✗"} {name}
          </Badge>
        ))}
      </div>
      {Object.values(php.extensions).some((loaded) => !loaded) && (
        <p className="text-xs text-destructive">
          افزونهٔ قرمز روی هاست فعال نیست؛ از پنل هاست (Select PHP Version → Extensions) روشنش
          کنید. نشانگر را روی هرکدام نگه دارید تا ببینید برای چیست.
        </p>
      )}
    </InfoCard>
  );
}

function UploadsCard({ health }: { health: SystemHealth }) {
  const { uploads } = health;
  return (
    <InfoCard icon={FolderOpen} title="فایل‌های آپلودی">
      <Row label="پوشهٔ uploads">
        {uploads.writable ? (
          <Badge variant="success">قابل نوشتن</Badge>
        ) : (
          <Badge variant="destructive">قابل نوشتن نیست</Badge>
        )}
      </Row>
      <Row label="تعداد فایل">
        {formatNumber(uploads.files)}
        {uploads.truncated && "+"}
      </Row>
      <Row label="حجم">{formatBytes(uploads.size_bytes)}</Row>
      {uploads.free_bytes !== null && <Row label="فضای خالی هاست">{formatBytes(uploads.free_bytes)}</Row>}
      {!uploads.writable && (
        <p className="text-xs text-destructive">
          تا این درست نشود، هیچ عکس یا فایلی آپلود نمی‌شود. در File Manager هاست، دسترسی پوشهٔ
          backend-php/public/uploads را روی 755 (یا 775) بگذارید.
        </p>
      )}
    </InfoCard>
  );
}

export function BackupCard() {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      await downloadBackup();
      toast.success("نسخهٔ پشتیبان دانلود شد.");
    } catch (error) {
      toast.error(getErrorMessage(error, "دریافت نسخهٔ پشتیبان ناموفق بود."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <InfoCard
      icon={Download}
      title="نسخهٔ پشتیبان"
      description="کل دیتابیس در یک فایل .sql.gz که در phpMyAdmin (تب Import) قابل بازگردانی است. نشست‌های ورود در آن نیست."
    >
      <Button onClick={download} disabled={busy} className="w-full">
        {busy ? <Loader2 className="animate-spin" /> : <Download />}
        {busy ? "در حال آماده‌سازی…" : "دانلود نسخهٔ پشتیبان"}
      </Button>
      <p className="text-xs leading-5 text-muted-foreground">
        این فایل رمزهای هش‌شده و کلیدهای پیامک و ایمیل را هم دارد؛ جای امنی نگهش دارید. اگر دیتابیس
        خیلی بزرگ شد و دانلود نیمه‌کاره ماند، از phpMyAdmin → Export بگیرید.
      </p>
    </InfoCard>
  );
}
