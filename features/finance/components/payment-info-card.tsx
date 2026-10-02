"use client";

import { Copy, Landmark } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { PaymentInfo } from "../services/finance-service";

export function formatCardNumber(card: string): string {
  return card.replace(/(\d{4})(?=\d)/g, "$1-");
}

function CopyRow({ label, value, display }: { label: string; value: string; display: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} کپی شد.`);
    } catch {
      toast.error("کپی نشد؛ دستی انتخاب کنید.");
    }
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p dir="ltr" className="truncate text-end font-mono text-sm font-medium text-foreground">
          {display}
        </p>
      </div>
      <Button type="button" size="icon" variant="ghost" onClick={copy} aria-label={`کپی ${label}`}>
        <Copy />
      </Button>
    </div>
  );
}

/**
 * Where the money for a subscription goes: the card the admin set in the
 * billing settings, shown to a club or a trainer paying for a plan. Nothing set = nothing shown
 * (see PaymentInfoMissing for the notice to put instead).
 */
export function PaymentInfoCard({ info }: { info: PaymentInfo | null | undefined }) {
  if (!info || (!info.card_number && !info.sheba && !info.instructions)) return null;

  const holder = [info.account_holder, info.bank_name && `بانک ${info.bank_name}`].filter(Boolean).join(" · ");

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Landmark className="size-4" />
        اطلاعات واریز
      </p>
      {info.card_number && (
        <CopyRow label="شماره کارت" value={info.card_number} display={formatCardNumber(info.card_number)} />
      )}
      {info.sheba && <CopyRow label="شماره شبا" value={info.sheba} display={info.sheba} />}
      {holder && <p className="text-xs text-muted-foreground">به نام: {holder}</p>}
      {info.instructions && (
        <p className="text-xs leading-5 whitespace-pre-line text-muted-foreground">
          {info.instructions}
        </p>
      )}
    </div>
  );
}

/** Whether the admin has put any receiving details for the payer to see. */
export function hasPaymentInfo(info: PaymentInfo | null | undefined): boolean {
  return !!info && !!(info.card_number || info.sheba || info.instructions);
}

/** Shown in place of the card when the admin has not entered it yet. */
export function PaymentInfoMissing() {
  return (
    <p className="rounded-xl border border-dashed border-border p-3 text-xs leading-5 text-muted-foreground">
      مدیریت هنوز شمارهٔ کارت را در سایت ثبت نکرده است. روش پرداخت را از پشتیبانی بپرسید.
    </p>
  );
}
