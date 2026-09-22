"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { RouteLoading } from "@/components/layout/route-loading";
import { useAuthContext } from "../hooks/use-auth-context";
import type { AccountType } from "@/types/database.types";

/**
 * Per-page replacement for the `redirect()` guards that used to run in each
 * Server Component:
 *
 *     const context = await getServerAuthContext();
 *     if (!context) redirect("/login");
 *     if (context.accountType !== "club") redirect("/dashboard");
 *
 * The session is already in the React Query cache by the time a panel page
 * renders — the surrounding layout fetched it — so this gate costs no extra
 * request and only decides what to show.
 *
 * Like every other guard in a static build this is routing, not security:
 * the page's HTML is a public file. RLS is what keeps the wrong role from
 * reading anything through it.
 */
export function RoleGate({
  allow,
  children,
}: {
  /** Account types allowed here. Omit to allow any signed-in user. */
  allow?: AccountType[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: context, isPending } = useAuthContext();

  const allowed =
    !!context && (!allow || (!!context.accountType && allow.includes(context.accountType)));

  useEffect(() => {
    if (isPending) return;
    if (!context) {
      router.replace("/login");
      return;
    }
    if (!allowed) router.replace("/dashboard");
  }, [context, isPending, allowed, router]);

  if (isPending || !allowed) return <RouteLoading />;

  return <>{children}</>;
}
