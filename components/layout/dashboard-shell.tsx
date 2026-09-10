import { Sidebar } from "./sidebar";
import { DashboardHeader } from "./dashboard-header";
import { InstallAppPrompt } from "@/components/pwa/install-app-prompt";
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
    // The pl/pr insets are the landscape case on a notched iPhone: with
    // viewport-fit=cover the page paints under the notch, and these keep the
    // panel clear of it. Both collapse to 0 in a browser tab.
    <div className="flex min-h-screen bg-background pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
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
        {/* py-6 is split so the bottom keeps its 1.5rem above whatever the
            home indicator reserves, instead of being overlapped by it. */}
        <main className="flex-1 px-4 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
          <InstallAppPrompt />
          {children}
        </main>
      </div>
    </div>
  );
}
