"use client";

import { useEffect } from "react";

import { installErrorReporter } from "@/lib/error-reporter";

/** Mounts the page-wide browser error reporter (lib/error-reporter.ts). */
export function ErrorReporter() {
  useEffect(() => installErrorReporter(), []);
  return null;
}
