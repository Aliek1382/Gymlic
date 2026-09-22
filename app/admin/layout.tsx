"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AdminShell } from "@/components/layout/admin-shell";
import { RouteLoading } from "@/components/layout/route-loading";
import { useAdminContext } from "@/features/authentication/hooks/use-auth-context";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: admin, isPending } = useAdminContext();

  // Not authenticated, or authenticated but not a platform admin — either
  // way this route group does not exist for them.
  //
  // On a static host this only decides what gets rendered: the /admin HTML is
  // a public file like any other. The admin_* RLS policies are what actually
  // keep a non-admin from reading anything through it.
  useEffect(() => {
    if (!isPending && !admin) router.replace("/dashboard");
  }, [admin, isPending, router]);

  if (isPending || !admin) return <RouteLoading />;

  return (
    <AdminShell fullName={admin.fullName} avatarUrl={admin.avatarUrl}>
      {children}
    </AdminShell>
  );
}
