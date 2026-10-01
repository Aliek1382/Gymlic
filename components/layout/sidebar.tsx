"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, LogOut, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BrandMark, BrandName } from "@/components/brand/brand-mark";
import { useSignOut } from "@/features/authentication/hooks/use-sign-out";
import { MessagesNavBadge } from "@/features/messages/components/messages-nav-badge";
import { featureForPath, useFeatureCheck } from "@/features/site-settings";
import {
  SIDEBAR_NAV,
  isNavGroup,
  type SidebarNavEntry,
  type SidebarNavItem,
} from "./sidebar-nav";
import type { AccountType } from "@/types/database.types";
import { SitePageLinks } from "@/features/site-pages/components/site-page-links";

function isItemActive(pathname: string, item: SidebarNavItem) {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLink({
  item,
  pathname,
  onNavigate,
  nested = false,
}: {
  item: SidebarNavItem;
  pathname: string;
  onNavigate?: () => void;
  nested?: boolean;
}) {
  const Icon = item.icon;
  const badge = item.href === "/messages" ? <MessagesNavBadge /> : null;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
        nested && "py-2",
        isItemActive(pathname, item)
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-muted"
      )}
    >
      <Icon className="size-[18px]" />
      {item.label}
      {badge}
    </Link>
  );

  if (!item.description) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="left" className="max-w-56 text-center">
        {item.description}
      </TooltipContent>
    </Tooltip>
  );
}

function NavEntry({
  entry,
  pathname,
  onNavigate,
  expanded,
  onToggle,
}: {
  entry: SidebarNavEntry;
  pathname: string;
  onNavigate?: () => void;
  expanded: Record<string, boolean>;
  onToggle: (label: string, next: boolean) => void;
}) {
  if (!isNavGroup(entry)) {
    return <NavLink item={entry} pathname={pathname} onNavigate={onNavigate} />;
  }

  const Icon = entry.icon;
  const hasActive = entry.children.some((child) => isItemActive(pathname, child));
  // A group holding the current page is open until the user closes it; any
  // other group stays closed until opened.
  const open = expanded[entry.label] ?? hasActive;
  const hasMessages = entry.children.some((child) => child.href === "/messages");

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onToggle(entry.label, !open)}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-muted",
          hasActive && !open
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground"
        )}
      >
        <Icon className="size-[18px]" />
        {entry.label}
        {!open && hasMessages && <MessagesNavBadge />}
        <ChevronDown
          className={cn(
            "mr-auto size-4 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="mr-5 mt-1 space-y-1 border-r border-sidebar-border pr-2">
          {entry.children.map((child) => (
            <NavLink
              key={child.href}
              item={child}
              pathname={pathname}
              onNavigate={onNavigate}
              nested
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SidebarContent({
  accountType,
  onNavigate,
}: {
  accountType: AccountType;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const signOut = useSignOut();
  const isEnabled = useFeatureCheck();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const entries = SIDEBAR_NAV[accountType].flatMap((entry): SidebarNavEntry[] => {
    if (!isNavGroup(entry)) return isEnabled(featureForPath(entry.href)) ? [entry] : [];
    const children = entry.children.filter((child) =>
      isEnabled(featureForPath(child.href))
    );
    return children.length > 0 ? [{ ...entry, children }] : [];
  });

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">
      <div className="flex shrink-0 items-center gap-2.5 px-6 py-6">
        <BrandMark className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground" iconClassName="size-5" />
        <span className="text-lg font-bold text-foreground"><BrandName /></span>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-4">
        <TooltipProvider delayDuration={300}>
          {entries.map((entry) => (
            <NavEntry
              key={isNavGroup(entry) ? entry.label : entry.href}
              entry={entry}
              pathname={pathname}
              onNavigate={onNavigate}
              expanded={expanded}
              onToggle={(label, next) =>
                setExpanded((current) => ({ ...current, [label]: next }))
              }
            />
          ))}
        </TooltipProvider>
      </nav>

      <div className="shrink-0 space-y-2 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">
        {accountType === "club" && (
          <Button className="w-full" size="lg" asChild>
            <Link href="/members?new=1" onClick={onNavigate}>
              <Plus />
              افزودن عضو جدید
            </Link>
          </Button>
        )}

        <SitePageLinks className="justify-start px-3.5" onNavigate={onNavigate} />

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
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 border-l border-sidebar-border bg-sidebar lg:block">
      <SidebarContent accountType={accountType} />
    </aside>
  );
}
