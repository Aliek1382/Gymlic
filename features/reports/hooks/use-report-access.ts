"use client";

import { useQuery } from "@tanstack/react-query";

import {
  getTrainerBilling,
  type ReportLevel,
} from "@/features/trainer-billing/services/trainer-billing-service";

const ORDER: ReportLevel[] = ["count", "basic", "full", "full_excel"];

export function reportIncludes(have: ReportLevel, need: ReportLevel): boolean {
  return ORDER.indexOf(have) >= ORDER.indexOf(need);
}

/**
 * Which report sections the trainer's plan opens (server: Limits reports).
 * The server refuses a locked section on its own; this only saves the page
 * from asking for it. Shares the subscription page's query, but always asks
 * again on opening the page: queries are kept across visits, and a plan
 * that changed since would show the wrong sections.
 */
export function useReportAccess() {
  const { data, isFetchedAfterMount } = useQuery({
    queryKey: ["trainer-billing"],
    queryFn: getTrainerBilling,
    staleTime: 0,
  });
  const effective: ReportLevel = data?.limits?.reports?.effective ?? "full_excel";
  const plans = data?.plans ?? [];

  return {
    // A failed request counts as fetched too: the page then falls back to
    // the server's own refusal rather than waiting forever.
    loading: !isFetchedAfterMount,
    allows: (need: ReportLevel) => reportIncludes(effective, need),
    /** The cheapest plan on sale that opens `need`, for "from plan X". */
    planFor: (need: ReportLevel) =>
      plans.find((plan) => plan.report_level == null || reportIncludes(plan.report_level, need))
        ?.name ?? null,
  };
}
