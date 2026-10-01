"use client";

import { useRef, useState } from "react";
import { ImageUp, Loader2, Palette, RotateCcw, Trash2, Type } from "lucide-react";
import { toast } from "sonner";

import { GymlicMark } from "@/components/brand/gymlic-mark";
import { DEFAULT_BRAND_NAME } from "@/components/brand/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/get-error-message";
import { brandVariables, contrastWithWhite, isBrandColor } from "@/lib/brand-theme";
import { toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";
import {
  useAdminSiteSettings,
  useSetBrandLogo,
  useUpdateSiteSetting,
  type BrandingSettings,
} from "@/features/site-settings";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import { SettingsStorageNotice } from "./settings-storage-notice";

/** Gymlic's own blue, what an empty color means. */
const DEFAULT_COLOR = "#3b5bfb";

/** Ready-made colors, all readable on white (the API asks for 3:1). */
const PRESETS = ["#3b5bfb", "#4f46e5", "#7c3aed", "#c026d3", "#e11d48", "#dc2626", "#c2410c", "#0f766e", "#15803d", "#0369a1", "#334155"];

const LOGO_TYPES = "image/png,image/jpeg,image/webp";

/** /admin/branding — the name, main color and logo the panel shows. */
export function AdminBrandingPage() {
  const { data, isLoading, isError } = useAdminSiteSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">برند و ظاهر</h1>
        <p className="text-sm text-muted-foreground">
          نام، رنگ اصلی و لوگویی که کاربران در پنل، صفحهٔ ورود و زبانهٔ مرورگر می‌بینند. تغییرات بلافاصله و
          بدون آپلود دوباره اعمال می‌شوند.
        </p>
      </div>

      {data && !data.storageReady && <SettingsStorageNotice />}

      {isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : isError || !data?.settings.branding ? (
        <ErrorState message="دریافت تنظیمات با خطا مواجه شد." />
      ) : (
        <BrandingForm initial={data.settings.branding} locked={!data.storageReady} />
      )}

      <Card className="gap-2 py-5">
        <div className="space-y-2 px-6 text-sm leading-6 text-muted-foreground">
          <p className="font-medium text-foreground">چه چیزهایی بدون build جدید عوض نمی‌شوند</p>
          <p>
            نام و آیکون اپلیکیشنِ نصب‌شده روی گوشی (PWA)، و عنوان و تصویری که هنگام فرستادن لینک سایت در پیام‌رسان‌ها
            دیده می‌شود، هنگام build در فایل‌های سایت نوشته می‌شوند و تا build و آپلود بعدی همان جیم‌لیک می‌مانند.
            متن پیامک‌ها و اعلان‌ها هم از صفحهٔ «قالب متن اعلان‌ها» تغییر می‌کند.
          </p>
        </div>
      </Card>
    </div>
  );
}

function BrandingForm({ initial, locked }: { initial: BrandingSettings; locked: boolean }) {
  const [name, setName] = useState(initial.app_name);
  const [color, setColor] = useState(initial.primary_color);
  const update = useUpdateSiteSetting("branding");

  const effective = isBrandColor(color) ? color.toLowerCase() : DEFAULT_COLOR;
  const typedInvalid = color !== "" && !isBrandColor(color);
  const tooLight = isBrandColor(color) && contrastWithWhite(color) < 3;
  const dirty = name.trim() !== initial.app_name || color.toLowerCase() !== initial.primary_color;

  function save() {
    update.mutate(
      { value: { ...initial, app_name: name.trim(), primary_color: color.toLowerCase() } },
      {
        onSuccess: (saved) => {
          setName(saved.app_name);
          setColor(saved.primary_color);
          toast.success("تغییرات ذخیره شد.");
        },
        onError: (error) => toast.error(getErrorMessage(error, "ذخیرهٔ تنظیمات با خطا مواجه شد.")),
      }
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Card className="gap-5 py-5">
          <CardHeading icon={Type} title="نام سایت" description="در منوی کناری، صفحهٔ ورود و عنوان زبانهٔ مرورگر." />
          <div className="space-y-2 px-6">
            <Label htmlFor="brand-name">نام</Label>
            <Input
              id="brand-name"
              value={name}
              maxLength={40}
              placeholder={DEFAULT_BRAND_NAME}
              onChange={(event) => setName(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">خالی بگذارید تا «{DEFAULT_BRAND_NAME}» نشان داده شود.</p>
          </div>
        </Card>

        <Card className="gap-5 py-5">
          <CardHeading
            icon={Palette}
            title="رنگ اصلی"
            description="رنگ دکمه‌ها، لینک‌ها، بخش انتخاب‌شدهٔ منو و نمودارها. رنگ‌های روشن‌تر از حد روی زمینهٔ سفید خوانا نیستند و پذیرفته نمی‌شوند."
          />
          <div className="space-y-4 px-6">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-label={`رنگ ${preset}`}
                  onClick={() => setColor(preset === DEFAULT_COLOR ? "" : preset)}
                  className={cn(
                    "size-8 rounded-full border-2 border-transparent ring-offset-2 transition",
                    effective === preset && "ring-2 ring-foreground"
                  )}
                  style={{ background: preset }}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label htmlFor="brand-color">کد رنگ</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="انتخاب رنگ"
                    value={effective}
                    onChange={(event) => setColor(event.target.value)}
                    className="h-9 w-12 cursor-pointer rounded-lg border border-input bg-transparent p-1"
                  />
                  <Input
                    id="brand-color"
                    dir="ltr"
                    className="w-32 font-mono"
                    value={color}
                    placeholder={DEFAULT_COLOR}
                    onChange={(event) => setColor(event.target.value.trim())}
                  />
                </div>
              </div>
              {color !== "" && (
                <Button variant="ghost" size="sm" onClick={() => setColor("")}>
                  <RotateCcw />
                  رنگ پیش‌فرض جیم‌لیک
                </Button>
              )}
            </div>
            {typedInvalid && <p className="text-xs text-destructive">کد رنگ باید به شکل ‎#RRGGBB باشد.</p>}
            {tooLight && (
              <p className="text-xs text-destructive">
                این رنگ روی زمینهٔ سفید خوانا نیست (کنتراست {toPersianDigits(contrastWithWhite(color).toFixed(1))} به ۱؛
                حداقل ۳ به ۱ لازم است). رنگ تیره‌تری انتخاب کنید.
              </p>
            )}
          </div>
          <div className="flex justify-end border-t border-border px-6 pt-4">
            <Button onClick={save} disabled={locked || update.isPending || !dirty || typedInvalid || tooLight}>
              {update.isPending && <Loader2 className="animate-spin" />}
              ذخیرهٔ نام و رنگ
            </Button>
          </div>
        </Card>

        <LogoCard logo={initial.logo_url} locked={locked} />
      </div>

      <Preview name={name.trim() || DEFAULT_BRAND_NAME} color={effective} logo={initial.logo_url} />
    </div>
  );
}

function LogoCard({ logo, locked }: { logo: string; locked: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const setLogo = useSetBrandLogo();

  function submit(file: File | null) {
    setLogo.mutate(file, {
      onSuccess: () => toast.success(file ? "لوگو بارگذاری شد." : "لوگو حذف شد و نشان جیم‌لیک برگشت."),
      onError: (error) => toast.error(getErrorMessage(error, "ذخیرهٔ لوگو ناموفق بود.")),
    });
  }

  return (
    <Card className="gap-5 py-5">
      <CardHeading
        icon={ImageUp}
        title="لوگو"
        description="جای نشان جیم‌لیک در منو و صفحهٔ ورود، و آیکون زبانهٔ مرورگر. مربعی، دست‌کم ۱۲۸ پیکسل، با زمینهٔ شفاف؛ PNG، JPG یا WebP تا ۲ مگابایت."
      />
      <div className="flex items-center gap-4 px-6">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- static export: no image optimizer
            <img src={logo} alt="لوگوی فعلی" className="size-14 object-contain" />
          ) : (
            <GymlicMark className="size-8 text-primary" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept={LOGO_TYPES}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) submit(file);
            }}
          />
          <Button variant="outline" disabled={locked || setLogo.isPending} onClick={() => input.current?.click()}>
            {setLogo.isPending ? <Loader2 className="animate-spin" /> : <ImageUp />}
            {logo ? "عوض‌کردن لوگو" : "بارگذاری لوگو"}
          </Button>
          {logo && (
            <Button variant="ghost" disabled={locked || setLogo.isPending} onClick={() => submit(null)}>
              <Trash2 />
              حذف لوگو
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/** The panel's pieces drawn with the draft color, before it's saved. */
function Preview({ name, color, logo }: { name: string; color: string; logo: string }) {
  return (
    <Card className="gap-4 py-5 lg:sticky lg:top-4">
      <div className="px-6">
        <CardTitle className="text-base">پیش‌نمایش</CardTitle>
        <CardDescription className="text-xs">پیش از ذخیره، با نام و رنگی که انتخاب کرده‌اید.</CardDescription>
      </div>
      <div className="px-6" style={brandVariables(color) as React.CSSProperties}>
        <div className="overflow-hidden rounded-2xl border border-border">
          <div className="flex">
            <div className="w-40 space-y-1 border-l border-border bg-sidebar p-3">
              <div className="mb-3 flex items-center gap-2">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- static export: no image optimizer
                  <img src={logo} alt="" className="size-8 object-contain" />
                ) : (
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <GymlicMark className="size-4" />
                  </div>
                )}
                <span className="truncate text-sm font-bold text-foreground">{name}</span>
              </div>
              <div className="rounded-lg bg-sidebar-accent px-2 py-1.5 text-xs font-medium text-sidebar-accent-foreground">
                داشبورد
              </div>
              <div className="px-2 py-1.5 text-xs text-sidebar-foreground">ورزشکاران</div>
              <div className="px-2 py-1.5 text-xs text-sidebar-foreground">برنامه‌ها</div>
            </div>
            <div className="flex-1 space-y-3 bg-background p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" tabIndex={-1}>دکمهٔ اصلی</Button>
                <Button size="sm" variant="outline" tabIndex={-1}>
                  دکمهٔ دوم
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>برچسب</Badge>
                <Badge variant="info">اطلاع</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                متن با <span className="text-primary underline underline-offset-4">لینک</span> در میان.
              </p>
              <div className="flex h-16 items-end gap-1.5">
                {[40, 65, 50, 85, 70, 95].map((height, i) => (
                  <div key={i} className="flex-1 rounded-t bg-chart-1" style={{ height: `${height}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function CardHeading({ icon: Icon, title, description }: { icon: typeof Type; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 px-6">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <Icon className="size-4" />
      </div>
      <div className="space-y-1">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-xs leading-5">{description}</CardDescription>
      </div>
    </div>
  );
}
