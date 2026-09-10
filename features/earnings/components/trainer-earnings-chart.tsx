"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { Wallet } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatToman } from "@/lib/persian";
import { SectionHeader } from "@/features/dashboard/components/shared/section-header";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { REVENUE_RANGE_OPTIONS } from "@/features/dashboard/constants/dashboard";
import type { EarningsPoint } from "../types/earnings-types";

/** The trainer's counterpart to the club's RevenueChart. */
export function TrainerEarningsChart({
  data,
  range,
  onRangeChange,
}: {
  data: EarningsPoint[];
  range: string;
  onRangeChange: (range: string) => void;
}) {
  const hasData = data.some((point) => point.value > 0);

  return (
    <Card className="py-5 lg:col-span-2">
      <SectionHeader
        title="روند درآمد"
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
          مجموع شهریه‌های دریافتی شما در هر ماه
        </p>

        {!hasData ? (
          <EmptyState
            icon={Wallet}
            title="هنوز پرداختی ثبت نکرده‌اید."
            description="با ثبت شهریه‌های دریافتی، روند درآمدتان اینجا نمایش داده می‌شود."
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
