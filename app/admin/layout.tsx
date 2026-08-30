import { redirect } from "next/navigation";

import { AdminShell } from "@/components/layout/admin-shell";
import { getAdminContext } from "@/features/admin/services/admin-server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminContext();

  // Not authenticated, or authenticated but not a platform admin — either
  // way this route group does not exist for them.
  if (!admin) redirect("/dashboard");

  return (
    <AdminShell fullName={admin.fullName} avatarUrl={admin.avatarUrl}>
      {children}
    </AdminShell>
  );
}
