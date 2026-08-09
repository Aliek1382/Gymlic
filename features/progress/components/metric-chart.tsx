"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { LineChart as LineChartIcon } from "lucide-react";

import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { toPersianDigits } from "@/lib/persian";

export function MetricChart({
  series,
  color,
  unit,
  height = 208,
}: {
  series: { label: string; value: number }[];
  color: string;
  unit: string;
  height?: number;
}) {
  if (series.length === 0) {
    return <EmptyState icon={LineChartIcon} title="هنوز داده‌ای ثبت نشده است." />;
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <Tooltip
            formatter={(value) =>
              `${toPersianDigits(Number(value))}${unit ? ` ${unit}` : ""}`
            }
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--card)",
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
