"use client";

import { useEffect, useRef, useState } from "react";
import type { PlanKind } from "../types/athlete-types";

export interface PrintablePlan {
  kind: PlanKind;
  title: string;
  description: string | null;
  assignedAt: string;
  athleteName?: string;
  athleteBirthDate?: string | null;
  athleteAvatarUrl?: string | null;
  trainerName?: string;
  trainerAvatarUrl?: string | null;
}

// Avatars are fetched from Supabase storage, so they can still be in flight
// when the print dialog opens — long enough to be captured as blank circles.
// Past this budget the sheet prints regardless: a missing avatar is a far
// smaller problem than a download that never starts.
const IMAGE_WAIT_MS = 1500;

// Drives window.print() for a single shared print-area instead of one per
// plan card — otherwise every card's print-area would match the global
// ".print-area" selector at once and the PDF would stack every plan
// together instead of just the one the trainer/athlete clicked.
export function usePlanPrint() {
  const [plan, setPlan] = useState<PrintablePlan | null>(null);
  const pendingPrint = useRef(false);

  useEffect(() => {
    if (!plan || !pendingPrint.current) return;
    pendingPrint.current = false;

    const loading = Array.from(
      document.querySelectorAll<HTMLImageElement>(".print-area img")
    ).filter((image) => !image.complete);

    if (loading.length === 0) {
      window.print();
      return;
    }

    let printed = false;
    let remaining = loading.length;

    function print() {
      if (printed) return;
      printed = true;
      window.print();
    }

    function settle() {
      remaining -= 1;
      if (remaining === 0) print();
    }

    for (const image of loading) {
      image.addEventListener("load", settle, { once: true });
      image.addEventListener("error", settle, { once: true });
    }

    const timer = setTimeout(print, IMAGE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [plan]);

  function printPlan(next: PrintablePlan) {
    pendingPrint.current = true;
    setPlan(next);
  }

  return { plan, printPlan };
}
