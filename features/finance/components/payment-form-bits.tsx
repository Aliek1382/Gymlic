"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumber, formatPersianDate, formatToman, parseLocaleNumber, toPersianDigits } from "@/lib/persian";
import type { PurchaseKind } from "../services/finance-service";

/**
 * The exact amount to transfer, large, with a button that copies the bare
 * digits — what a banking app's amount field wants.
 */
export function AmountToPay({
  amount,
  caption = "مبلغ قابل پرداخت",
}: {
  amount: number;
  caption?: string;
}) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(String(amount));
      toast.success("مبلغ کپی شد.");
    } catch {
      toast.error("کپی نشد؛ مبلغ را دستی وارد کنید.");
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{caption}</p>
        <p className="text-2xl font-bold text-foreground">
          {formatNumber(amount)} <span className="text-sm font-normal text-muted-foreground">تومان</span>
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        <Copy />
        کپی مبلغ
      </Button>
    </div>
  );
}

/**
 * How an upgrade is priced: the new plan's price less the running one's, and
 * the end date that stays.
 */
export function UpgradeNote({
  from,
  fromPrice,
  to,
  toPrice,
  expiresAt,
}: {
  from: string;
  fromPrice: number;
  to: string;
  toPrice: number;
  expiresAt: string;
}) {
  return (
    <div className="space-y-1 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
      <p>
        ارتقا از «{from}»: {formatToman(toPrice)} − {formatToman(fromPrice)} ={" "}
        <span className="font-medium text-foreground">{formatToman(Math.max(0, toPrice - fromPrice))} تومان</span>
      </p>
      <p>
        بعد از تأیید، پلن «{to}» با همهٔ امکاناتش فعال می‌شود و تاریخ پایان همان{" "}
        {formatPersianDate(new Date(expiresAt.replace(" ", "T")))} می‌ماند. برای تمدید بعدی، قیمت کامل پلن پرداخت می‌شود.
      </p>
    </div>
  );
}

/** Under a request's plan: an upgrade (and from what), a renewal, or the admin's switch. */
export function PurchaseKindNote({ kind, from }: { kind?: PurchaseKind | null; from?: string | null }) {
  if (kind === "upgrade") {
    return <p className="text-xs font-medium text-success">ارتقا{from ? ` از «${from}»` : ""} · فقط تفاوت قیمت</p>;
  }
  if (kind === "renew") return <p className="text-xs text-muted-foreground">تمدید</p>;
  if (kind === "switch") return <p className="text-xs text-muted-foreground">تغییر پلن توسط مدیریت</p>;
  return null;
}

/** What the payer typed in the amount field, as a whole number; null when blank or not a number. */
export function parsePaidAmount(value: string): number | null {
  const parsed = parseLocaleNumber(value);
  return parsed !== null && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/** The amount the payer actually transferred, so the reviewer can compare it with what was owed. */
export function PaidAmountField({
  id,
  value,
  onChange,
  expected,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** What was owed, to warn when the typed amount differs. */
  expected: number;
}) {
  const parsed = parsePaidAmount(value);
  const differs = parsed !== null && parsed !== expected;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>مبلغی که واریز کردید (تومان)</Label>
      <Input
        id={id}
        dir="ltr"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {differs && (
        <p className="text-xs text-warning">
          این مبلغ با مبلغ قابل پرداخت ({toPersianDigits(expected.toLocaleString("en-US"))} تومان) فرق دارد؛ درخواست شما با این هشدار نزد بررسی‌کننده می‌رود.
        </p>
      )}
    </div>
  );
}

/** Whole days a request has been waiting, from its created_at ("YYYY-MM-DD HH:MM:SS", server time). */
export function waitingDays(createdAt: string): number {
  const created = new Date(createdAt.replace(" ", "T"));
  if (Number.isNaN(created.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - created.getTime()) / 86_400_000));
}

/** What the reviewer should look at twice before approving. */
export function PaymentFlags({
  duplicate,
  mismatch,
  paidAmount,
  expected,
}: {
  duplicate?: boolean;
  mismatch?: boolean;
  paidAmount?: number | null;
  expected?: number;
}) {
  if (!duplicate && !mismatch) return null;
  return (
    <div className="space-y-1">
      {mismatch && paidAmount != null && expected != null && (
        <p className="text-xs font-medium text-warning">
          مبلغ اعلام‌شده {formatNumber(paidAmount)} تومان است، نه {formatNumber(expected)} تومان
        </p>
      )}
      {duplicate && (
        <p className="text-xs font-medium text-warning">این کد پیگیری در درخواست دیگری هم آمده است</p>
      )}
    </div>
  );
}
