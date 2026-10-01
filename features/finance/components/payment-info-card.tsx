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

/** Where a club transfers the money for its subscription. Nothing set = nothing shown. */
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
