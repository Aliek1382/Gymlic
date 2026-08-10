import { Sidebar } from "./sidebar";
import { DashboardHeader } from "./dashboard-header";
import type { AccountType } from "@/types/database.types";

interface DashboardShellProps {
  accountType: AccountType;
  fullName: string;
  roleLabel: string;
  avatarUrl: string | null;
  userId: string;
  children: React.ReactNode;
}

export function DashboardShell({
  accountType,
  fullName,
  roleLabel,
  avatarUrl,
  userId,
  children,
}: DashboardShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar accountType={accountType} />
      {/* min-w-0 is required: without it this flex-1 column can't shrink
          below the natural width of its widest un-wrapped content (e.g. a
          long activity title), which silently overflows the viewport since
          overflow-x is hidden globally instead of scrolling. */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <DashboardHeader
          accountType={accountType}
          fullName={fullName}
          roleLabel={roleLabel}
          avatarUrl={avatarUrl}
          userId={userId}
        />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
