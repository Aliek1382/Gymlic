"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { RouteLoading } from "@/components/layout/route-loading";

/**
 * Client-side stand-in for `redirect()` in a page that is prerendered at
 * build time, where there is no request to redirect.
 */
export function NavigateTo({ href }: { href: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(href);
  }, [href, router]);

  return <RouteLoading />;
}
