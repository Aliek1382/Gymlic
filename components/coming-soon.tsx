import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";

export function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Card className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <Icon className="size-6" />
      </div>
      <div className="space-y-1.5 px-6">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      </div>
    </Card>
  );
}
