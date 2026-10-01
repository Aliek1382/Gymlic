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
import { formatCardNumber } from "./payment-info-card";

/** The account someone receives card-to-card payments on (a trainer, or a club). */
export interface PaymentAccount {
  card_number: string;
  sheba: string;
  holder_name: string;
  bank_name: string;
}

const digitsOnly = (value: string) => toAsciiDigits(value).replace(/\D+/g, "");

interface PaymentAccountCardProps {
  title: string;
  description: string;
  queryKey: readonly unknown[];
  load: () => Promise<{ ready: boolean; info: PaymentAccount }>;
  save: (info: PaymentAccount) => Promise<void>;
  /** Other cached views that show this account (what a payer sees). */
  alsoInvalidate?: readonly (readonly unknown[])[];
}

/** Form for a card number, optional IBAN, holder and bank; hidden until the server can store it. */
export function PaymentAccountCard(props: PaymentAccountCardProps) {
  const { data, isLoading } = useQuery({ queryKey: props.queryKey, queryFn: props.load });

  if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  // Before the server's database update there is nowhere to save it.
  if (!data?.ready) return null;

  return <AccountForm key={JSON.stringify(data.info)} initial={data.info} {...props} />;
}

function AccountForm({
  initial,
  title,
  description,
  queryKey,
  save,
  alsoInvalidate = [],
}: PaymentAccountCardProps & { initial: PaymentAccount }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<PaymentAccount>({
    ...initial,
    card_number: formatCardNumber(initial.card_number),
    sheba: initial.sheba.replace(/^IR/, ""),
  });
  const [saving, setSaving] = useState(false);
  const patch = (next: Partial<PaymentAccount>) => setDraft((d) => ({ ...d, ...next }));

  async function submit() {
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
      await save({
        card_number: card,
        sheba: sheba ? `IR${sheba}` : "",
        holder_name: draft.holder_name.trim(),
        bank_name: draft.bank_name.trim(),
      });
      toast.success("اطلاعات دریافت پرداخت ذخیره شد.");
      void queryClient.invalidateQueries({ queryKey });
      for (const key of alsoInvalidate) void queryClient.invalidateQueries({ queryKey: key });
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیره ناموفق بود."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="gap-5 py-5">
      <div className="space-y-1 px-6">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
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
        <Button onClick={submit} disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          ذخیره
        </Button>
      </div>
    </Card>
  );
}
