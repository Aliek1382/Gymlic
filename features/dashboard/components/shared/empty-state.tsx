import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      {Icon && (
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </div>
      )}
      <div className="space-y-1">
        <p className="font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
