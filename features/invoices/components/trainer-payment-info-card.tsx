"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCardNumber } from "@/features/finance/components/payment-info-card";
import { getErrorMessage } from "@/lib/get-error-message";
import { toAsciiDigits } from "@/lib/persian";
import { useTrainerPaymentInfo } from "../hooks/use-trainer-payment-info";
import { saveTrainerPaymentInfo, type TrainerPaymentInfo } from "../services/invoice-service";

const QUERY_KEY = ["invoices", "payment-info"] as const;
const digitsOnly = (value: string) => toAsciiDigits(value).replace(/\D+/g, "");

/** Where athletes send card-to-card payments for the trainer's invoices. */
export function TrainerPaymentInfoCard() {
  const { data, isLoading } = useTrainerPaymentInfo();

  if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  // Before the server's database update there is nowhere to save it.
  if (!data?.ready) return null;

  return <PaymentInfoForm key={JSON.stringify(data.info)} initial={data.info} />;
}

function PaymentInfoForm({ initial }: { initial: TrainerPaymentInfo }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<TrainerPaymentInfo>({
    ...initial,
    card_number: formatCardNumber(initial.card_number),
    sheba: initial.sheba.replace(/^IR/, ""),
  });
  const [saving, setSaving] = useState(false);
  const patch = (next: Partial<TrainerPaymentInfo>) => setDraft((d) => ({ ...d, ...next }));

  async function save() {
    const card = digitsOnly(draft.card_number);
    const sheba = digitsOnly(draft.sheba);
    if (card && card.length !== 16) {
      toast.error("شمارهٔ کارت باید ۱۶ رقم باشد.");
      return;
    }
    if (sheba && sheba.length !== 24) {
      toast.error("شمارهٔ شبا باید ۲۴ رقم (بعد از IR) باشد.");
      return;
    }
    setSaving(true);
    try {
      await saveTrainerPaymentInfo({
        card_number: card,
        sheba: sheba ? `IR${sheba}` : "",
        holder_name: draft.holder_name.trim(),
        bank_name: draft.bank_name.trim(),
      });
      toast.success("اطلاعات دریافت پرداخت ذخیره شد.");
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["invoices", "mine"] });
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیره ناموفق بود."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="gap-5 py-5">
      <div className="space-y-1 px-6">
        <CardTitle className="text-base">دریافت پرداخت از ورزشکاران</CardTitle>
        <CardDescription>
          ورزشکارانی که فاکتور دارند این کارت را می‌بینند، به آن واریز می‌کنند و کد پیگیری و رسید را
          ثبت می‌کنند. شما بعد از دیدن واریز در حساب خود، پرداخت را تأیید می‌کنید. شمارهٔ کارت فقط
          برای ورزشکاری که از شما فاکتور دارد دیده می‌شود.
        </CardDescription>
      </div>
      <div className="space-y-4 px-6">
        <div className="space-y-2">
          <Label htmlFor="tpi-card">شمارهٔ کارت</Label>
          <Input
            id="tpi-card"
            dir="ltr"
            inputMode="numeric"
            value={draft.card_number}
            placeholder="6037-9900-0000-0000"
            onChange={(e) => patch({ card_number: formatCardNumber(digitsOnly(e.target.value).slice(0, 16)) })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tpi-sheba">
            شمارهٔ شبا <span className="text-muted-foreground">(اختیاری)</span>
          </Label>
          <div dir="ltr" className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">IR</span>
            <Input
              id="tpi-sheba"
              dir="ltr"
              inputMode="numeric"
              value={draft.sheba}
              placeholder="۲۴ رقم"
              onChange={(e) => patch({ sheba: digitsOnly(e.target.value).slice(0, 24) })}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tpi-holder">به نام</Label>
            <Input
              id="tpi-holder"
              maxLength={100}
              value={draft.holder_name}
              onChange={(e) => patch({ holder_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tpi-bank">بانک</Label>
            <Input
              id="tpi-bank"
              maxLength={60}
              value={draft.bank_name}
              placeholder="مثلاً: ملت"
              onChange={(e) => patch({ bank_name: e.target.value })}
            />
          </div>
        </div>
      </div>
      <div className="px-6">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          ذخیره
        </Button>
      </div>
    </Card>
  );
}
