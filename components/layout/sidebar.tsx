"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/features/authentication/hooks/use-sign-out";
import { SIDEBAR_NAV } from "./sidebar-nav";
import type { AccountType } from "@/types/database.types";

export function SidebarContent({
  accountType,
  onNavigate,
}: {
  accountType: AccountType;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const signOut = useSignOut();
  const items = SIDEBAR_NAV[accountType];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-6 py-6">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <span className="text-base font-bold">G</span>
        </div>
        <span className="text-lg font-bold text-foreground">جیم‌لیک</span>
      </div>

      <nav className="flex-1 space-y-1 px-4">
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
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
      </nav>

      <div className="space-y-2 px-4 pb-6 pt-4">
        {accountType === "club" && (
          <Button className="w-full" size="lg" asChild>
            <Link href="/members?new=1" onClick={onNavigate}>
              <Plus />
              افزودن عضو جدید
            </Link>
          </Button>
        )}

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

export function Sidebar({ accountType }: { accountType: AccountType }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-l border-sidebar-border bg-sidebar lg:block">
      <SidebarContent accountType={accountType} />
    </aside>
  );
}
