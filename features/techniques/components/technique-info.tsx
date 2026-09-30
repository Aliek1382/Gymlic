"use client";

import { useState } from "react";
import { Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * The info icon beside an exercise that has a technique. Hover shows the
 * explanation on desktop; a click toggles it, which is what makes it
 * reachable on touch screens where Radix's hover-only tooltip never opens.
 * Stays inline so it fits the compact plan rows.
 */
export function TechniqueInfo({
  name,
  description,
}: {
  name: string;
  description: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`توضیح تکنیک ${name}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-full text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setOpen((current) => !current)}
          >
            <Info className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-64 space-y-0.5 text-start" side="top">
          <p className="font-bold">{name}</p>
          {description ? (
            <p className="whitespace-pre-line leading-5">{description}</p>
          ) : (
            <p className="opacity-80">توضیحی برای این تکنیک ثبت نشده است.</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
