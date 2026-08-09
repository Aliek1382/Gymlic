"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

// A plain, dependency-free expand/collapse section (no Radix primitive
// needed for behavior this simple) — closed by default, so optional form
// sections don't add to the page's initial length/scroll until a trainer
// actually wants to use them.
export function CollapsibleSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string | null;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-right"
        aria-expanded={open}
      >
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-xs font-medium text-muted-foreground">
          {title}
          {summary && (
            <span className="truncate text-xs font-medium text-foreground">
              {summary}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && <div className="space-y-2 border-t border-border p-3">{children}</div>}
    </div>
  );
}
