import { Ruler } from "lucide-react";

import { Card, CardTitle } from "@/components/ui/card";
import { formatPersianDate, toPersianDigits } from "@/lib/persian";
import { EmptyState } from "../shared/empty-state";
import type { MeasurementEntry } from "../../types/dashboard-types";

export function MeasurementsCard({
  latest,
  history,
}: {
  latest: MeasurementEntry | null;
  history: MeasurementEntry[];
}) {
  return (
    <Card className="gap-4 py-5">
      <div className="px-6">
        <CardTitle className="text-base">آخرین اندازه‌گیری‌ها</CardTitle>
      </div>

      <div className="px-6">
        {!latest ? (
          <EmptyState
            icon={Ruler}
            title="هنوز اندازه‌گیری‌ای ثبت نشده است."
            description="مربی شما پس از اولین جلسه، قد و وزن شما را ثبت می‌کند."
          />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted p-4 text-center">
                <p className="text-xs text-muted-foreground">قد</p>
                <p className="text-xl font-bold text-foreground">
                  {latest.heightCm ? `${toPersianDigits(latest.heightCm)} سانتی‌متر` : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-muted p-4 text-center">
                <p className="text-xs text-muted-foreground">وزن</p>
                <p className="text-xl font-bold text-foreground">
                  {latest.weightKg ? `${toPersianDigits(latest.weightKg)} کیلوگرم` : "—"}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              {history.slice(0, 4).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">
                    {formatPersianDate(new Date(entry.recordedAt))}
                  </span>
                  <span className="font-medium text-foreground">
                    {entry.weightKg ? `${toPersianDigits(entry.weightKg)} کیلوگرم` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
