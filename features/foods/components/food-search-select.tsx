"use client";

import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useFoodsForPicker } from "../hooks/use-foods-for-picker";
import type { FoodPickerItem } from "../types/food-types";
import { FoodMacroTag } from "./food-macro-tag";

// A long library is unusable as a plain dropdown on a phone, so the list is
// searched instead of scrolled — and capped, so an empty search box doesn't
// render hundreds of rows. The API already orders it most-used-first.
const MAX_RESULTS = 30;

function matches(food: FoodPickerItem, query: string): boolean {
  const q = query.toLowerCase();
  return (
    food.name.toLowerCase().includes(q) ||
    (food.nameEn ?? "").toLowerCase().includes(q) ||
    food.category.toLowerCase().includes(q)
  );
}

/**
 * Pick one food from the library by searching it. Once one is chosen the list
 * collapses to that food (with a clear button), which keeps the form short on
 * a phone. `value` is the food's id; `onChange` gets the whole item, so the
 * caller has its unit and macros without a second lookup.
 */
export function FoodSearchSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (food: FoodPickerItem | null) => void;
}) {
  const foods = useFoodsForPicker();
  const [query, setQuery] = useState("");

  const selected = value ? foods.data?.find((food) => food.id === value) : undefined;

  const results = useMemo(() => {
    const data = foods.data ?? [];
    const q = query.trim();
    return (q ? data.filter((food) => matches(food, q)) : data).slice(0, MAX_RESULTS);
  }, [foods.data, query]);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Check className="size-4 shrink-0 text-primary" />
          <span className="text-sm font-medium text-foreground">{selected.name}</span>
          <FoodMacroTag food={selected} />
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setQuery("");
          }}
          aria-label="تغییر غذا"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جستجوی غذا در بانک غذا..."
          className="pr-10"
        />
      </div>

      <div className="max-h-56 overflow-y-auto rounded-xl border border-border">
        {foods.isLoading ? (
          <p className="p-3 text-xs text-muted-foreground">در حال بارگذاری بانک غذا...</p>
        ) : results.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">غذایی با این نام پیدا نشد.</p>
        ) : (
          results.map((food) => (
            <button
              key={food.id}
              type="button"
              onClick={() => onChange(food)}
              className={cn(
                "flex min-h-11 w-full flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-border px-3 py-2 text-right last:border-b-0",
                "hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
              )}
            >
              <span className="min-w-0 text-sm text-foreground">
                {food.name}
                <span className="mr-1.5 text-[11px] text-muted-foreground">
                  {food.category}
                </span>
              </span>
              <FoodMacroTag food={food} />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
