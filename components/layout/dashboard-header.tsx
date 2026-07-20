"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronLeft, CircleHelp, LogOut, Search, User as UserIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSignOut } from "@/features/authentication/hooks/use-sign-out";
import { MobileSidebar } from "./mobile-sidebar";
import { SIDEBAR_NAV } from "./sidebar-nav";
import type { AccountType } from "@/types/database.types";

interface DashboardHeaderProps {
  accountType: AccountType;
  fullName: string;
  roleLabel: string;
  avatarUrl: string | null;
}

export function DashboardHeader({
  accountType,
  fullName,
  roleLabel,
  avatarUrl,
}: DashboardHeaderProps) {
  const signOut = useSignOut();
  const pathname = usePathname();
  const initials = fullName.trim().slice(0, 2) || "کا";
  const pageTitle =
    SIDEBAR_NAV[accountType].find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    )?.label ?? "داشبورد";

  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
      <MobileSidebar accountType={accountType} />

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-3 rounded-xl p-1.5 text-right outline-none hover:bg-muted">
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
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <UserIcon />
              تنظیمات حساب
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => signOut.mutate()}
            disabled={signOut.isPending}
          >
            <LogOut />
            خروج
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        type="button"
        className="hidden size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted sm:flex"
        aria-label="راهنما"
      >
        <CircleHelp className="size-[18px]" />
      </button>

      <button
        type="button"
        className="relative hidden size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted sm:flex"
        aria-label="اعلان‌ها"
      >
        <Bell className="size-[18px]" />
        <span className="absolute right-2 top-2 size-1.5 rounded-full bg-destructive" />
      </button>

      <div className="hidden flex-1 md:block">
        <div className="mx-auto flex max-w-md items-center gap-2 rounded-full border border-input bg-muted/60 px-4 py-2 text-sm text-muted-foreground">
          <Search className="size-4" />
          <span className="flex-1 truncate">جستجوی سریع</span>
          <kbd className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px]">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="hidden items-center gap-1.5 text-sm text-muted-foreground lg:flex">
        <span className="text-foreground">جیم‌لیک</span>
        <ChevronLeft className="size-4" />
        <span className="font-medium text-foreground">{pageTitle}</span>
      </div>
    </header>
  );
}
