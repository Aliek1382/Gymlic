"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { formatCompactNumber, toPersianDigits } from "@/lib/persian";
import { SectionHeader } from "../shared/section-header";
import { EmptyState } from "../shared/empty-state";
import type { MemberDistribution } from "../../types/dashboard-types";

export function MemberDistributionChart({
  data,
}: {
  data: MemberDistribution;
}) {
  if (data.totalActive === 0) {
    return (
      <Card className="py-5">
        <SectionHeader title="توزیع اعضا" />
        <div className="px-6">
          <EmptyState
            icon={PieChartIcon}
            title="هنوز عضو فعالی ثبت نشده است."
            description="با ثبت اولین عضو، نمودار توزیع نمایش داده می‌شود."
          />
        </div>
      </Card>
    );
  }

  return (
    <Card className="py-5">
      <SectionHeader title="توزیع اعضا" />
      <div className="space-y-4 px-6">
        <p className="-mt-4 text-xs text-muted-foreground">
          بر اساس نوع اشتراک
        </p>

        <div className="relative mx-auto h-48 w-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.segments}
                dataKey="percent"
                nameKey="label"
                innerRadius={62}
                outerRadius={88}
                paddingAngle={2}
                stroke="none"
              >
                {data.segments.map((segment) => (
                  <Cell key={segment.label} fill={segment.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-foreground">
              {formatCompactNumber(data.totalActive)}
            </span>
            <span className="text-xs text-muted-foreground">فعال</span>
          </div>
        </div>

        <div className="space-y-2.5">
          {data.segments.map((segment) => (
            <div
              key={segment.label}
              className="flex items-center justify-between text-sm"
            >
              <span className="flex items-center gap-2 text-foreground">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: segment.color }}
                />
                {segment.label}
              </span>
              <span className="font-medium text-muted-foreground">
                {toPersianDigits(segment.percent)}٪
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
