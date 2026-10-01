"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogOut } from "lucide-react";

import { cn } from "@/lib/utils";
import { GymlicMark } from "@/components/brand/gymlic-mark";
import { useSignOut } from "@/features/authentication/hooks/use-sign-out";
import { ADMIN_SIDEBAR_GROUPS } from "./admin-sidebar-nav";

export function AdminSidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const signOut = useSignOut();

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">
      <div className="flex shrink-0 items-center gap-2.5 px-6 py-6">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <GymlicMark className="size-5" />
        </div>
        <div>
          <span className="block text-lg font-bold text-foreground">جیم‌لیک</span>
          <span className="block text-xs font-medium text-muted-foreground">
            پنل مدیریت کل
          </span>
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-2">
        {ADMIN_SIDEBAR_GROUPS.map((group, index) => (
          <div key={group.title ?? index} className="space-y-1">
            {group.title && (
              <p className="px-3.5 pb-1 text-[11px] font-semibold text-muted-foreground">
                {group.title}
              </p>
            )}
            {group.items.map((item) => {
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="size-[18px]" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-2 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-muted"
        >
          <LayoutDashboard className="size-[18px]" />
          بازگشت به داشبورد
        </Link>

        <button
          type="button"
          onClick={() => signOut.mutate()}
          disabled={signOut.isPending}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-muted disabled:opacity-60"
        >
          <LogOut className="size-[18px]" />
          خروج
        </button>
      </div>
    </div>
  );
}

export function AdminSidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 border-l border-sidebar-border bg-sidebar lg:block">
      <AdminSidebarContent />
    </aside>
  );
}
