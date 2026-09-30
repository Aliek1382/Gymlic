"use client";

import { useMemo, useState } from "react";
import { Pill, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { TableCardSkeleton } from "@/features/dashboard/components/shared/dashboard-skeleton";
import { useSupplements } from "../hooks/use-supplements";
import type { SupplementSummary } from "../types/supplement-types";

function matchesQuery(supplement: SupplementSummary, query: string): boolean {
  const q = query.toLowerCase();
  return (
    supplement.name.toLowerCase().includes(q) ||
    (supplement.nameEn ?? "").toLowerCase().includes(q)
  );
}

export function SupplementList() {
  const supplements = useSupplements();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim();
    const data = supplements.data ?? [];
    return query ? data.filter((item) => matchesQuery(item, query)) : data;
  }, [supplements.data, search]);

  if (supplements.isLoading) {
    return <TableCardSkeleton />;
  }

  if (supplements.isError) {
    return (
      <Card className="border-destructive/30 py-5">
        <p className="px-6 text-sm text-destructive">
          دریافت کتابخانه مکمل‌ها با خطا مواجه شد. صفحه را دوباره بارگذاری کنید.
        </p>
      </Card>
    );
  }

  if ((supplements.data?.length ?? 0) === 0) {
    return (
      <Card className="py-5">
        <EmptyState
          icon={Pill}
          title="هنوز مکملی ثبت نشده است."
          description="با دکمه «افزودن مکمل جدید» اولین مکمل خود را ثبت کنید."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جستجوی نام مکمل (فارسی یا انگلیسی)..."
          className="pr-10"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="py-5">
          <EmptyState
            icon={Search}
            title="نتیجه‌ای پیدا نشد."
            description="مکملی با این نام پیدا نشد."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-2 rounded-xl border border-border p-3"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">{item.name}</p>
                {item.nameEn && (
                  <p dir="ltr" className="text-xs text-muted-foreground">
                    {item.nameEn}
                  </p>
                )}
                {item.description && (
                  <p className="line-clamp-3 text-xs leading-5 text-muted-foreground">
                    {item.description}
                  </p>
                )}
              </div>
              {item.isCustom && (
                <div>
                  <Badge variant="info">مکمل شما</Badge>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
