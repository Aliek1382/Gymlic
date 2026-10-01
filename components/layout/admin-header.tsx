"use client";

import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAdminContext } from "@/features/authentication/hooks/use-auth-context";
import { adminNavItemFor } from "./admin-sidebar-nav";
import { AdminMobileSidebar } from "./admin-mobile-sidebar";

interface AdminHeaderProps {
  fullName: string;
  avatarUrl: string | null;
}

export function AdminHeader({ fullName, avatarUrl }: AdminHeaderProps) {
  const pathname = usePathname();
  const initials = fullName.trim().slice(0, 2) || "کا";
  const { data: admin } = useAdminContext();
  const pageTitle = adminNavItemFor(pathname)?.label ?? "پنل مدیریت";
  const roleLabel =
    admin?.access.level === "staff" ? (admin.access.roleName ?? "مدیر") : "مدیر کل پلتفرم";

  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
      <AdminMobileSidebar />

      <div className="flex items-center gap-3">
        <Avatar>
          {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="hidden sm:block">
          <p className="text-sm font-semibold leading-tight text-foreground">
            {fullName}
          </p>
          <p className="text-xs leading-tight text-muted-foreground">
            {roleLabel}
          </p>
        </div>
      </div>

      <div className="flex-1" />

      <div className="hidden items-center gap-1.5 text-sm text-muted-foreground lg:flex">
        <span className="text-foreground">پنل مدیریت</span>
        <ChevronLeft className="size-4" />
        <span className="font-medium text-foreground">{pageTitle}</span>
      </div>
    </header>
  );
}
