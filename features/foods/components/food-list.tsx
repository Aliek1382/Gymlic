"use client";

import { useMemo, useState } from "react";
import { Apple, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { TableCardSkeleton } from "@/features/dashboard/components/shared/dashboard-skeleton";
import { useFoods } from "../hooks/use-foods";
import type { FoodSummary } from "../types/food-types";

function groupByCategory(foods: FoodSummary[]) {
  const groups = new Map<string, FoodSummary[]>();
  for (const food of foods) {
    const list = groups.get(food.category) ?? [];
    list.push(food);
    groups.set(food.category, list);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "fa"));
}

function matchesQuery(food: FoodSummary, query: string): boolean {
  const q = query.toLowerCase();
  return (
    food.name.toLowerCase().includes(q) ||
    (food.nameEn ?? "").toLowerCase().includes(q) ||
    food.category.toLowerCase().includes(q)
  );
}

export function FoodList() {
  const foods = useFoods();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim();
    const data = foods.data ?? [];
    return query ? data.filter((food) => matchesQuery(food, query)) : data;
  }, [foods.data, search]);

  const groups = useMemo(() => groupByCategory(filtered), [filtered]);

  if (foods.isLoading) {
    return <TableCardSkeleton />;
  }

  if (foods.isError) {
    return (
      <Card className="border-destructive/30 py-5">
        <p className="px-6 text-sm text-destructive">
          دریافت کتابخانه غذاها با خطا مواجه شد. صفحه را دوباره بارگذاری کنید.
        </p>
      </Card>
    );
  }

  if ((foods.data?.length ?? 0) === 0) {
    return (
      <Card className="py-5">
        <EmptyState
          icon={Apple}
          title="هنوز غذایی ثبت نشده است."
          description="با دکمه «افزودن غذای جدید» اولین غذای خود را ثبت کنید."
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
          placeholder="جستجوی نام غذا (فارسی یا انگلیسی) یا دسته غذایی..."
          className="pr-10"
        />
      </div>

      {groups.length === 0 ? (
        <Card className="py-5">
          <EmptyState
            icon={Search}
            title="نتیجه‌ای پیدا نشد."
            description="غذایی با این نام یا دسته غذایی پیدا نشد."
          />
        </Card>
      ) : (
        groups.map(([category, items]) => (
          <Card key={category} className="gap-4 py-5">
            <div className="px-6">
              <CardTitle className="text-base">{category}</CardTitle>
            </div>
            <div className="grid grid-cols-1 gap-2 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
              {items.map((food) => (
                <div
                  key={food.id}
                  className="flex flex-col gap-2 rounded-xl border border-border p-3"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">{food.name}</p>
                    {food.nameEn && (
                      <p dir="ltr" className="text-xs text-muted-foreground">
                        {food.nameEn}
                      </p>
                    )}
                    {food.description && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {food.description}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary">{food.category}</Badge>
                    <Badge variant="outline">{food.defaultUnit}</Badge>
                    {food.isCustom && <Badge variant="info">غذای شما</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
