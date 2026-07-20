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

import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatToman } from "@/lib/persian";
import { SectionHeader } from "../shared/section-header";
import { EmptyState } from "../shared/empty-state";
import { REVENUE_RANGE_OPTIONS } from "../../constants/dashboard";
import type { RevenuePoint } from "../../types/dashboard-types";

export function RevenueChart({
  data,
  range,
  onRangeChange,
}: {
  data: RevenuePoint[];
  range: string;
  onRangeChange: (range: string) => void;
}) {
  const hasData = data.some((point) => point.value > 0);

  return (
    <Card className="py-5 lg:col-span-2">
      <SectionHeader
        title="رشد درآمد"
        action={
          <Select value={range} onValueChange={onRangeChange}>
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REVENUE_RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <div className="px-6">
        <p className="-mt-4 mb-4 text-xs text-muted-foreground">
          صورتحساب شده در مقابل پرداخت شده در هر ماه
        </p>

        {!hasData ? (
          <EmptyState
            icon={LineChartIcon}
            title="هنوز درآمدی برای این باشگاه ثبت نشده است."
          />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value) => formatToman(Number(value))}
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
                  stroke="var(--chart-1)"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}
