"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toAsciiDigits } from "@/lib/persian";
import { FOOD_UNITS } from "../constants/foods";
import { useFoodsForPicker } from "../hooks/use-foods-for-picker";
import { useRecordFoodUsage } from "../hooks/use-record-food-usage";
import type { FoodPickerItem } from "../types/food-types";

export function FoodPicker({
  onInsert,
  category = null,
}: {
  onInsert: (line: string) => void;
  // Tags the inserted line as "[منابع پروتئینی] …" so the category travels
  // with the food instead of with the meal heading. Null when the trainer
  // picked no category, or when the category is already serving as the
  // heading itself.
  category?: string | null;
}) {
  const foods = useFoodsForPicker();
  const recordUsage = useRecordFoodUsage();

  const [foodId, setFoodId] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("");
  const [note, setNote] = useState("");

  function findFood(id: string): FoodPickerItem | undefined {
    return foods.data?.find((food) => food.id === id);
  }

  // A custom food can carry a unit a trainer typed themselves, so the chosen
  // food's own unit is unioned in rather than dropped for not being one of
  // the presets.
  const selected = findFood(foodId);
  const unitOptions = [
    ...FOOD_UNITS,
    ...(selected && !FOOD_UNITS.some((u) => u === selected.defaultUnit)
      ? [selected.defaultUnit]
      : []),
  ];

  function handleSelectFood(id: string) {
    setFoodId(id);
    setUnit(findFood(id)?.defaultUnit ?? "");
  }

  function buildEntry(): { line: string; foodId: string } | null {
    const food = selected;
    const normalized = toAsciiDigits(amount.trim());
    if (!food || !unit || !(Number(normalized) > 0)) return null;

    const prefix = category ? `[${category}] ` : "";
    const suffix = note.trim() ? ` (${note.trim()})` : "";
    return {
      line: `${prefix}${food.name} — ${normalized} ${unit}${suffix}`,
      foodId: food.id,
    };
  }

  const entry = buildEntry();

  function handleAdd() {
    if (!entry) return;
    onInsert(entry.line);
    recordUsage.mutate(entry.foodId);

    setFoodId("");
    setAmount("");
    setUnit("");
    setNote("");
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          انتخاب غذا از کتابخانه
        </p>
        <Select value={foodId} onValueChange={handleSelectFood}>
          <SelectTrigger className="w-full justify-start">
            <SelectValue placeholder="انتخاب غذا..." className="min-w-0 truncate" />
          </SelectTrigger>
          <SelectContent>
            {foods.data?.map((food) => (
              <SelectItem key={food.id} value={food.id}>
                {food.name}
                {food.nameEn ? ` / ${food.nameEn}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="مقدار"
            className="text-center sm:w-32"
          />
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger className="w-full justify-start sm:w-40">
              <SelectValue placeholder="واحد" className="min-w-0 truncate" />
            </SelectTrigger>
            <SelectContent>
              {unitOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <CollapsibleSection title="توضیح (اختیاری)" summary={note.trim() || null}>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="مثلاً آب‌پز، بعد از تمرین، بدون نمک..."
        />
      </CollapsibleSection>

      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={entry === null}
        onClick={handleAdd}
        className="w-full"
      >
        <Plus />
        افزودن به برنامه
      </Button>
    </div>
  );
}
