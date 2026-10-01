"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/get-error-message";
import { toAsciiDigits } from "@/lib/persian";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import { PaymentInfoCard, formatCardNumber } from "@/features/finance/components/payment-info-card";
import {
  getBillingSettings,
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
