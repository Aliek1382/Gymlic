import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TrendDirection } from "../../types/dashboard-types";

const TREND_VARIANT: Record<TrendDirection, "success" | "destructive" | "warning"> = {
  up: "success",
  down: "destructive",
  flat: "warning",
};

interface StatisticCardProps {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  value: string;
  trend?: { direction: TrendDirection; label: string };
  footer?: React.ReactNode;
}

export function StatisticCard({
  icon: Icon,
  iconClassName,
  title,
  value,
  trend,
  footer,
}: StatisticCardProps) {
  return (
    <Card className="relative gap-4 py-5">
      {trend && (
        <Badge
          variant={TREND_VARIANT[trend.direction]}
          className="absolute -top-2 left-4"
        >
          {trend.label}
        </Badge>
      )}

      <div className="flex flex-col gap-4 px-5">
        <div
          className={cn(
            "flex size-11 items-center justify-center rounded-xl bg-info-muted text-info",
            iconClassName
          )}
        >
          <Icon className="size-5" />
        </div>

        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>

        {footer}
      </div>
    </Card>
  );
}
