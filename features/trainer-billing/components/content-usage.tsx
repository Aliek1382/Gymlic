"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatNumber } from "@/lib/persian";
import { getTrainerBilling, type ContentUsage } from "../services/trainer-billing-service";

const LABEL = { exercises: "حرکت سفارشی", templates: "قالب" } as const;

/** The trainer's plan limits, shared with the subscription page's query. */
export function useTrainerContent() {
  const { data } = useQuery({ queryKey: ["trainer-billing"], queryFn: getTrainerBilling });
  const limits = data?.limits;
  if (!limits?.ready || !limits.content) return null;
  // The cheapest plan on sale with templates, for "from plan X".
  const withTemplates = (data?.plans ?? []).find((p) => p.max_templates === null || (p.max_templates ?? 0) > 0);
  return { content: limits.content, enforcing: limits.enforcing, templatesFrom: withTemplates?.name ?? null };
}

/** Whether templates are closed to this trainer altogether (their plan allows none). */
export function useTemplatesClosed(): { closed: boolean; planName: string | null } {
  const state = useTrainerContent();
  if (!state) return { closed: false, planName: null };
  const cap = capOf(state.content.templates, state.enforcing, state.content.via_club);
  return { closed: cap === 0, planName: state.templatesFrom };
}

/** Said instead of opening the template form when the plan has no templates. */
export function TemplatesUpgradeDialog({
  open,
  onOpenChange,
  planName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>قالب شخصی در پلن فعلی نیست</DialogTitle>
          <DialogDescription>
            {planName ? `قالب شخصی از پلن «${planName}» فعال است. ` : ""}برای ساخت قالب، پلن خود را ارتقا دهید.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button asChild>
            <Link href="/subscription">ارتقا</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "Up to the cap" only counts while the caps are enforced and not lifted by a club. */
export function capOf(usage: ContentUsage, enforcing: boolean, viaClub: boolean): number | null {
  return enforcing && !viaClub ? usage.max : null;
}

/**
 * "۴ از ۵ حرکت سفارشی" (just the count when unlimited), and a plain note
 * when the trainer has more than the plan allows after a paid plan ended.
 */
export function ContentUsageLine({ kind }: { kind: "exercises" | "templates" }) {
  const state = useTrainerContent();
  if (!state) return null;
  const usage = state.content[kind];
  const cap = capOf(usage, state.enforcing, state.content.via_club);

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {cap === null
          ? `${formatNumber(usage.used)} ${LABEL[kind]}`
          : cap === 0
            ? `${LABEL[kind]} شخصی در پلن فعلی شما نیست${usage.used > 0 ? ` (${formatNumber(usage.used)} ${LABEL[kind]} از قبل دارید)` : ""}.`
            : `${formatNumber(usage.used)} از ${formatNumber(cap)} ${LABEL[kind]}`}
      </p>
      {cap !== null && usage.used > cap && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            {kind === "exercises"
              ? `پلن فعلی شما تا ${formatNumber(cap)} حرکت سفارشی دارد. حرکت‌های فعلی می‌مانند و قابل استفاده‌اند؛ تا زیر سقف نیامده، حرکت تازه ساخته نمی‌شود.`
              : cap === 0
                ? "پلن فعلی شما قالب شخصی ندارد. قالب‌های فعلی می‌مانند و قابل استفاده‌اند؛ قالب تازه ساخته نمی‌شود."
                : `پلن فعلی شما تا ${formatNumber(cap)} قالب دارد. قالب‌های فعلی می‌مانند و قابل استفاده‌اند؛ تا زیر سقف نیامده، قالب تازه ساخته نمی‌شود.`}
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link href="/subscription">ارتقا</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
