"use client";

import { Layers } from "lucide-react";

import { useAuthContext } from "@/features/authentication/hooks/use-auth-context";

/** "سطح پلن: طلایی" beside a subscription page's title; nothing when the account isn't limited by a tier. */
export function MyTierBadge() {
  const { data: context } = useAuthContext();
  if (!context?.tier?.key) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
      <Layers className="size-3.5" />
      سطح پلن: {context.tier.label}
    </span>
  );
}
