"use client";

import { useEffect, useRef, useState } from "react";
import type { PlanKind } from "../types/athlete-types";

export interface PrintablePlan {
  kind: PlanKind;
  title: string;
  description: string | null;
  assignedAt: string;
  athleteName?: string;
  trainerName?: string;
}

// Drives window.print() for a single shared print-area instead of one per
// plan card — otherwise every card's print-area would match the global
// ".print-area" selector at once and the PDF would stack every plan
// together instead of just the one the trainer/athlete clicked.
export function usePlanPrint() {
  const [plan, setPlan] = useState<PrintablePlan | null>(null);
  const pendingPrint = useRef(false);

  useEffect(() => {
    if (plan && pendingPrint.current) {
      pendingPrint.current = false;
      window.print();
    }
  }, [plan]);

  function printPlan(next: PrintablePlan) {
    pendingPrint.current = true;
    setPlan(next);
  }

  return { plan, printPlan };
}
