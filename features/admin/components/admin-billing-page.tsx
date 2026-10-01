"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/get-error-message";
import { toAsciiDigits } from "@/lib/persian";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import { PaymentInfoCard, formatCardNumber } from "@/features/finance/components/payment-info-card";
import {
  getBillingSettings,
  getReceiptStats,
  purgeReceipts,
  saveBillingSettings,
  type BillingSettings,
} from "../services/admin-billing-service";
import { SettingsStorageNotice } from "./settings-storage-notice";

const QUERY_KEY = ["admin", "billing-settings"] as const;

const TEXTAREA_CLASS =
  "w-full rounded-xl border border-input bg-transparent px-4 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-50";

const digitsOnly = (value: string) => toAsciiDigits(value).replace(/\D+/g, "");

export function AdminBillingPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: QUERY_KEY, queryFn: getBillingSettings });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">اطلاعات پرداخت</h1>
        <p className="text-sm text-muted-foreground">
          شماره کارت و شبایی که باشگاه‌ها هنگام ثبت درخواست پرداخت اشتراک می‌بینند.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : isError || !data ? (
        <ErrorState message="دریافت تنظیمات با خطا مواجه شد." />
      ) : (
        <>
          {!data.storageReady && <SettingsStorageNotice />}
          <BillingForm key={JSON.stringify(data.settings)} initial={data.settings} locked={!data.storageReady} />
        </>
      )}
    </div>
  );
}

function BillingForm({ initial, locked }: { initial: BillingSettings; locked: boolean }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<BillingSettings>({
    ...initial,
    card_number: formatCardNumber(initial.card_number),
    sheba: initial.sheba.replace(/^IR/, ""),
  });
  const [saving, setSaving] = useState(false);
  const patch = (next: Partial<BillingSettings>) => setDraft((d) => ({ ...d, ...next }));

  const value: BillingSettings = {
    ...draft,
    card_number: digitsOnly(draft.card_number),
    sheba: digitsOnly(draft.sheba) ? `IR${digitsOnly(draft.sheba)}` : "",
    expiring_days: Number(digitsOnly(String(draft.expiring_days))) || 7,
    receipt_max_mb: Number(digitsOnly(String(draft.receipt_max_mb))) || 0,
    receipt_retention_days: Number(digitsOnly(String(draft.receipt_retention_days))) || 0,
  };

  async function save() {
    if (value.card_number && value.card_number.length !== 16) {
      toast.error("شماره کارت باید ۱۶ رقم باشد.");
      return;
    }
    if (value.sheba && value.sheba.length !== 26) {
      toast.error("شماره شبا باید ۲۴ رقم (بعد از IR) باشد.");
      return;
    }
    if (value.expiring_days < 1 || value.expiring_days > 60) {
      toast.error("تعداد روز «رو به اتمام» باید بین ۱ و ۶۰ باشد.");
      return;
    }
    if (value.receipt_max_mb < 1 || value.receipt_max_mb > 10) {
      toast.error("حداکثر حجم رسید باید بین ۱ و ۱۰ مگابایت باشد.");
      return;
    }
    if (value.receipt_retention_days > 365) {
      toast.error("مدت نگهداری رسید حداکثر ۳۶۵ روز است.");
      return;
    }
    setSaving(true);
    try {
      await saveBillingSettings(value);
      toast.success("اطلاعات پرداخت ذخیره شد.");
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیره ناموفق بود."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
      <Card className="gap-5 py-5">
        <div className="space-y-1 px-6">
          <CardTitle className="text-base">حساب دریافت</CardTitle>
          <CardDescription>
            شماره کارت و شبا پیش از ذخیره بررسی می‌شوند تا اشتباه تایپی پول باشگاه‌ها را جای دیگری
            نفرستد.
          </CardDescription>
        </div>
        <div className="space-y-4 px-6">
          <div className="space-y-2">
            <Label htmlFor="billing-card">شماره کارت</Label>
            <Input
              id="billing-card"
              dir="ltr"
              inputMode="numeric"
              disabled={locked}
              value={draft.card_number}
              placeholder="6037-9900-0000-0000"
              onChange={(e) => patch({ card_number: formatCardNumber(digitsOnly(e.target.value).slice(0, 16)) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing-sheba">شماره شبا</Label>
            <div dir="ltr" className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">IR</span>
              <Input
                id="billing-sheba"
                dir="ltr"
                inputMode="numeric"
                disabled={locked}
                value={draft.sheba}
                placeholder="۲۴ رقم"
                onChange={(e) => patch({ sheba: digitsOnly(e.target.value).slice(0, 24) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="billing-holder">به نام</Label>
              <Input
                id="billing-holder"
                disabled={locked}
                maxLength={100}
                value={draft.account_holder}
                onChange={(e) => patch({ account_holder: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing-bank">بانک</Label>
              <Input
                id="billing-bank"
                disabled={locked}
                maxLength={60}
                value={draft.bank_name}
                placeholder="مثلاً: ملت"
                onChange={(e) => patch({ bank_name: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing-instructions">
              توضیحات برای باشگاه <span className="text-muted-foreground">(اختیاری)</span>
            </Label>
            <textarea
              id="billing-instructions"
              rows={3}
              maxLength={1000}
              disabled={locked}
              value={draft.instructions}
              placeholder="مثلاً: بعد از واریز، چهار رقم آخر کارت و کد پیگیری را در توضیحات بنویسید."
              onChange={(e) => patch({ instructions: e.target.value })}
              className={TEXTAREA_CLASS}
            />
          </div>
        </div>

        <div className="space-y-4 border-t border-border px-6 pt-5">
          <div className="space-y-1">
            <CardTitle className="text-base">اشتراک رو به اتمام</CardTitle>
            <CardDescription>
              از چند روز مانده به انقضا، اشتراک «رو به اتمام» نشان داده شود — هم در صفحهٔ اشتراک‌ها و
              هم برای خود باشگاه.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Input
              id="billing-expiring"
              dir="ltr"
              inputMode="numeric"
              disabled={locked}
              className="w-24"
              value={String(draft.expiring_days)}
              onChange={(e) => patch({ expiring_days: Number(digitsOnly(e.target.value).slice(0, 2)) || 0 })}
            />
            <span className="text-sm text-muted-foreground">روز</span>
          </div>
        </div>

        <div className="space-y-4 border-t border-border px-6 pt-5">
          <div className="space-y-1">
            <CardTitle className="text-base">رسید پرداخت</CardTitle>
            <CardDescription>
              باشگاه هنگام ثبت درخواست، کد پیگیری و چهار رقم آخر کارتش را همیشه وارد می‌کند. تصویر
              رسید در مرورگر کوچک و در سرور دوباره فشرده می‌شود و پس از بررسی درخواست، خودکار حذف
              می‌شود. درخواست‌های در انتظار، رسیدشان را تا زمان بررسی نگه می‌دارند. همین تنظیمات برای
              رسیدی که ورزشکار برای پرداخت به مربی می‌فرستد هم اعمال می‌شود.
            </CardDescription>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
            <div>
              <Label htmlFor="billing-receipt-required">پیوست رسید الزامی باشد</Label>
              <p className="text-xs text-muted-foreground">
                اگر خاموش باشد، باشگاه می‌تواند بدون تصویر رسید هم درخواست ثبت کند.
              </p>
            </div>
            <Switch
              id="billing-receipt-required"
              checked={draft.receipt_required}
              disabled={locked}
              onCheckedChange={(receipt_required) => patch({ receipt_required })}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="billing-receipt-mb">حداکثر حجم رسید (مگابایت)</Label>
              <Input
                id="billing-receipt-mb"
                dir="ltr"
                inputMode="numeric"
                disabled={locked}
                className="w-24"
                value={String(draft.receipt_max_mb)}
                onChange={(e) => patch({ receipt_max_mb: Number(digitsOnly(e.target.value).slice(0, 2)) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing-receipt-days">حذف رسید، چند روز پس از بررسی</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="billing-receipt-days"
                  dir="ltr"
                  inputMode="numeric"
                  disabled={locked}
                  className="w-24"
                  value={String(draft.receipt_retention_days)}
                  onChange={(e) =>
                    patch({ receipt_retention_days: Number(digitsOnly(e.target.value).slice(0, 3)) || 0 })
                  }
                />
                <span className="text-sm text-muted-foreground">روز (۰ = حذف نشود)</span>
              </div>
            </div>
          </div>
          <ReceiptStorage />
        </div>

        <div className="px-6">
          <Button onClick={save} disabled={saving || locked}>
            {saving && <Loader2 className="animate-spin" />}
            ذخیره
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">پیش‌نمایش برای باشگاه</p>
        {value.card_number || value.sheba || value.instructions ? (
          <PaymentInfoCard info={value} />
        ) : (
          <p className="rounded-xl border border-dashed border-border p-4 text-xs leading-5 text-muted-foreground">
            چیزی وارد نشده؛ باشگاه‌ها فقط فرم درخواست پرداخت را می‌بینند.
          </p>
        )}
      </div>
    </div>
  );
}

const formatMegabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} مگابایت`;

/** What the receipts folder holds now, and a button to run the cleanup immediately. */
function ReceiptStorage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "receipt-stats"], queryFn: getReceiptStats });
  const [purging, setPurging] = useState(false);

  if (!data) return null;
  if (!data.ready) {
    return (
      <p className="rounded-xl border border-dashed border-border p-3 text-xs leading-5 text-muted-foreground">
        ذخیرهٔ رسید هنوز فعال نیست: به‌روزرسانی «رسید پرداخت» را از صفحهٔ پایگاه‌داده اجرا کنید.
      </p>
    );
  }

  async function purge() {
    setPurging(true);
    try {
      const result = await purgeReceipts();
      toast.success(
        result.deleted > 0
          ? `${result.deleted} رسید حذف شد (${formatMegabytes(result.freed_bytes)}).`
          : "رسیدی برای حذف نبود."
      );
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    } catch (error) {
      toast.error(getErrorMessage(error, "پاکسازی ناموفق بود."));
    } finally {
      setPurging(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        الان {data.count} فایل رسید ذخیره است ({formatMegabytes(data.bytes)}).
      </p>
      <Button type="button" size="sm" variant="outline" onClick={purge} disabled={purging}>
        {purging ? <Loader2 className="animate-spin" /> : <Trash2 />}
        پاکسازی رسیدهای منقضی
      </Button>
    </div>
  );
}
