"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/persian";
import { useHiddenPlans } from "../hooks/use-plans";
import type { PlanKind, PlanTarget } from "../types/athlete-types";

/**
 * Under a trainer's plan list, when the history limit of their plan hides
 * old finished plans: how many, and that a higher plan shows them. Nothing
 * when none are hidden.
 */
export function HiddenPlansNote({ kind, target, enabled = true }: { kind: PlanKind; target: PlanTarget; enabled?: boolean }) {
  const { data: hidden } = useHiddenPlans(kind, target, enabled);
  if (!hidden || hidden.count === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground">
        {formatNumber(hidden.count)} برنامه پنهان است.
        {hidden.months !== null && ` برنامه‌های قدیمی‌تر از ${formatNumber(hidden.months)} ماه را در پلن بالاتر ببینید.`}
      </p>
      <Button size="sm" variant="outline" asChild>
        <Link href="/subscription">ارتقا</Link>
      </Button>
    </div>
  );
}
