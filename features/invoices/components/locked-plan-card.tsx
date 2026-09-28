import { Lock } from "lucide-react";

import { formatNumber, toPersianDigits } from "@/lib/persian";
import type { PlanInvoiceSummary } from "../types/invoice-types";

/**
 * What an athlete sees in place of a plan whose invoice is still pending. The
 * plan's text isn't sent by the API at all — the blur here is only decoration
 * over placeholder lines, never over real content.
 */
export function LockedPlanCard({ invoice }: { invoice: PlanInvoiceSummary }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border">
      <div aria-hidden className="space-y-2 p-4 blur-sm select-none">
        <div className="h-3 w-2/3 rounded bg-muted" />
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-5/6 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/70 p-4 text-center">
        <Lock className="size-5 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">
          مبلغ فاکتور: {formatNumber(invoice.amountToman)} تومان
        </p>
        <p className="text-xs text-muted-foreground">
          برای مشاهده برنامه، هزینه را با مربی خود تسویه کنید.
        </p>
        <p className="text-xs text-muted-foreground">
          شماره فاکتور: {toPersianDigits(invoice.number)}
        </p>
      </div>
    </div>
  );
}
