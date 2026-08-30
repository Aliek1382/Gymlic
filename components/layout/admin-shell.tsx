import { AdminSidebar } from "./admin-sidebar";
import { AdminHeader } from "./admin-header";

interface AdminShellProps {
  fullName: string;
  avatarUrl: string | null;
  children: React.ReactNode;
}

export function AdminShell({ fullName, avatarUrl, children }: AdminShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <AdminHeader fullName={fullName} avatarUrl={avatarUrl} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
