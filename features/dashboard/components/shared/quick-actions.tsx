import Link from "next/link";

import { Card } from "@/components/ui/card";
import { SectionHeader } from "./section-header";
import type { QuickAction } from "../../types/dashboard-types";

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <Card className="py-5">
      <SectionHeader title="اقدامات سریع" />
      <div className="grid grid-cols-2 gap-3 px-6 sm:grid-cols-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 text-center transition-colors hover:bg-muted"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="size-5" />
              </div>
              <span className="text-xs font-medium text-foreground">
                {action.label}
              </span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
