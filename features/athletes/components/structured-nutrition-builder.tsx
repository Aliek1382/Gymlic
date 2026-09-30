"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FOOD_UNITS, FoodSearchSelect, formatMacro, useRecordFoodUsage } from "@/features/foods";
import type { FoodPickerItem } from "@/features/foods";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber, parseLocaleNumber, toPersianDigits } from "@/lib/persian";
import { useAthleteProfile } from "../hooks/use-athlete-profile";
import { useAutosavePatch } from "../hooks/use-autosave-patch";
import { useNutritionPlanBuilder } from "../hooks/use-nutrition-plan-builder";
import { useNutritionPlanMeals } from "../hooks/use-nutrition-plan-meals";
import { useNutritionTotals } from "../hooks/use-nutrition-totals";
import {
  DEFAULT_MEALS_PER_DAY,
  itemIssue,
  itemMacros,
  itemUnit,
  suggestAmount,
  toNutritionGoal,
} from "../utils/nutrition-macros";
import { MEALS } from "../utils/nutrition-plan-text";
import type {
  NutritionGoal,
  NutritionPlanItem,
  NutritionPlanMeal,
} from "../types/nutrition-plan-builder-types";
import { NutritionSummaryBar } from "./nutrition-summary-bar";

// Nothing here has a save button: a meal's name and every food's amount, unit
// and note are written to nutrition_plan_meals / nutrition_plan_items as they
// change (debounced, see useAutosavePatch), and picking a food adds it on the
// spot. The totals never wait for the server — they are summed from the same
// meals the fields edit, in the same render.
const MAX_AMOUNT = 99999.99;
const NO_MEALS: NutritionPlanMeal[] = [];

type Builder = ReturnType<typeof useNutritionPlanBuilder>;

// Counts how many rows still have an edit waiting or in flight, to drive the
// "saving…" indicator without any row knowing about the others.
function useSaveTracker() {
  const busyIds = useRef(new Set<string>());
  const [saving, setSaving] = useState(false);

  function report(id: string, busy: boolean) {
    if (busy) busyIds.current.add(id);
    else busyIds.current.delete(id);
    setSaving(busyIds.current.size > 0);
  }

  return { saving, report };
}

// Labels sit above the field rather than only inside it: a placeholder is
// gone the moment something is typed, and on a phone the fields are narrow
// enough that a bare number is hard to interpret.
function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function ItemRow({
  mealId,
  item,
  suggested,
  builder,
  report,
}: {
  mealId: string;
  item: NutritionPlanItem;
  suggested: boolean;
  builder: Builder;
  report: (id: string, busy: boolean) => void;
}) {
  const [amountText, setAmountText] = useState(String(item.amount));
  const [note, setNote] = useState(item.note ?? "");
  const [edited, setEdited] = useState(false);

  const save = useAutosavePatch<{ amount: number; unit: string | null; note: string | null }>(
    (patch) => builder.saveItem(mealId, item.id, patch),
    {
      onBusyChange: (busy) => report(item.id, busy),
      onError: (error) =>
        toast.error(getErrorMessage(error, "ذخیره تغییر با خطا مواجه شد؛ اتصال را بررسی کنید.")),
    }
  );

  const parsedAmount = parseLocaleNumber(amountText);
  const amount = parsedAmount === null ? null : Math.round(parsedAmount * 100) / 100;
  const amountInvalid = amount === null || amount <= 0 || amount > MAX_AMOUNT;

  const unit = itemUnit(item);
  const unitOptions = [
    item.defaultUnit,
    ...FOOD_UNITS.filter((option) => option !== item.defaultUnit),
    ...(FOOD_UNITS.some((option) => option === unit) || unit === item.defaultUnit ? [] : [unit]),
  ];

  const issue = itemIssue(item);
  const macros = itemMacros(item);

  function handleAmountChange(text: string) {
    setAmountText(text);
    setEdited(true);
    const parsed = parseLocaleNumber(text);
    const next = parsed === null ? null : Math.round(parsed * 100) / 100;
    // An empty or half-typed value isn't pushed anywhere: the last valid
    // amount stays in the totals and on the server until a valid one arrives.
    if (next === null || next <= 0 || next > MAX_AMOUNT) return;
    builder.patchItem(mealId, item.id, { amount: next });
    save({ amount: next });
  }

  function handleUnitChange(next: string) {
    // The food's own unit is stored as NULL ("whatever the default is").
    const stored = next === item.defaultUnit ? null : next;
    builder.patchItem(mealId, item.id, { unit: stored });
    save({ unit: stored });
  }

  function handleNoteChange(text: string) {
    setNote(text);
    const stored = text.trim() === "" ? null : text;
    builder.patchItem(mealId, item.id, { note: stored });
    save({ note: stored });
  }

  async function handleRemove() {
    try {
      await builder.removeItem.mutateAsync({ mealId, itemId: item.id });
    } catch (error) {
      toast.error(getErrorMessage(error, "حذف غذا با خطا مواجه شد."));
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-6 text-foreground">{item.foodName}</p>
          <p className="text-[11px] text-muted-foreground">{item.category}</p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={`حذف ${item.foodName}`}
          disabled={builder.removeItem.isPending}
          onClick={handleRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <LabeledField label="مقدار">
          <Input
            value={amountText}
            onChange={(e) => handleAmountChange(e.target.value)}
            inputMode="decimal"
            placeholder="مثلا 1.5"
            aria-invalid={amountInvalid}
            className="text-center"
          />
        </LabeledField>
        <LabeledField label="واحد">
          <Select value={unit} onValueChange={handleUnitChange}>
            <SelectTrigger className="w-full justify-start">
              <SelectValue className="min-w-0 truncate" />
            </SelectTrigger>
            <SelectContent>
              {unitOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </LabeledField>
      </div>

      {amountInvalid && (
        <p className="text-[11px] text-destructive">
          مقدار باید عددی بزرگ‌تر از صفر باشد؛ تا اصلاح، آخرین مقدار معتبر ذخیره می‌ماند.
        </p>
      )}
      {suggested && !edited && (
        <p className="flex items-center gap-1 text-[11px] text-primary">
          <Sparkles className="size-3 shrink-0" />
          مقدار پیشنهادی از روی هدف ورزشکار — قابل ویرایش
        </p>
      )}

      {issue === "unit-mismatch" ? (
        <p className="text-[11px] leading-5 text-warning">
          ارزش غذایی این غذا برای «{item.defaultUnit}» ثبت شده؛ با واحد دیگر در جمع حساب نمی‌شود.
        </p>
      ) : (
        <p className="text-[11px] leading-5 text-muted-foreground">
          {item.caloriesPerUnit === null ? (
            <span className="text-warning">مقدار ماکرو ثبت نشده — در جمع صفر حساب می‌شود.</span>
          ) : (
            <>
              <span className="font-medium text-foreground">
                {formatNumber(macros.calories)} کالری
              </span>
              {" · "}پروتئین {formatMacro(macros.protein)} · کربو {formatMacro(macros.carbs)} ·
              چربی {formatMacro(macros.fat)}
              {issue === "no-macros" && (
                <span className="text-warning"> (بعضی مقادیر ثبت نشده و صفر حساب شده‌اند)</span>
              )}
            </>
          )}
        </p>
      )}

      <Input
        value={note}
        onChange={(e) => handleNoteChange(e.target.value)}
        maxLength={255}
        placeholder="یادداشت (اختیاری) — مثلاً آب‌پز"
        aria-label={`یادداشت ${item.foodName}`}
        className="h-10 text-xs"
      />
    </div>
  );
}

function MealCard({
  meal,
  mealsPerDay,
  goal,
  totals,
  suggestedIds,
  onSuggested,
  builder,
  report,
}: {
  meal: NutritionPlanMeal;
  mealsPerDay: number;
  goal: NutritionGoal | null;
  totals: ReturnType<typeof useNutritionTotals>["byMeal"][string];
  suggestedIds: Set<string>;
  onSuggested: (itemId: string) => void;
  builder: Builder;
  report: (id: string, busy: boolean) => void;
}) {
  const recordUsage = useRecordFoodUsage();
  const [mealName, setMealName] = useState(meal.mealName);
  const [pickerOpen, setPickerOpen] = useState(meal.items.length === 0);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [adding, setAdding] = useState(false);

  const saveName = useAutosavePatch<{ mealName: string }>(
    (patch) => builder.saveMeal(meal.id, patch),
    {
      onBusyChange: (busy) => report(meal.id, busy),
      onError: (error) => toast.error(getErrorMessage(error, "ذخیره نام وعده با خطا مواجه شد.")),
    }
  );

  function handleNameChange(text: string) {
    setMealName(text);
    // The API rejects an empty name, so a cleared field keeps the last one.
    if (text.trim() === "") return;
    builder.renameMeal(meal.id, text);
    saveName({ mealName: text.trim() });
  }

  async function handlePickFood(food: FoodPickerItem | null) {
    if (!food || adding) return;
    setAdding(true);
    // The suggestion is an editable head start; a food it can't be worked out
    // for starts at one unit so the row exists and can be adjusted.
    const suggestion = suggestAmount(food, goal, mealsPerDay);
    try {
      const created = await builder.addItem.mutateAsync({
        mealId: meal.id,
        food,
        amount: suggestion ?? 1,
      });
      if (suggestion !== null) onSuggested(created.id);
      recordUsage.mutate(food.id);
      setPickerOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "افزودن غذا با خطا مواجه شد."));
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveMeal() {
    await builder.removeMeal.mutateAsync(meal.id);
  }

  // An empty meal goes straight away; one with foods asks first.
  async function handleRemoveClick() {
    if (meal.items.length > 0) {
      setConfirmingRemove(true);
      return;
    }
    try {
      await handleRemoveMeal();
    } catch (error) {
      toast.error(getErrorMessage(error, "حذف وعده با خطا مواجه شد."));
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-border p-3">
      <div className="flex items-center gap-2">
        <Input
          value={mealName}
          onChange={(e) => handleNameChange(e.target.value)}
          maxLength={100}
          aria-label="نام وعده"
          className="h-10 flex-1 font-medium"
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-10 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={`حذف ${meal.mealName}`}
          onClick={handleRemoveClick}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {meal.items.length > 0 && (
        <div className="space-y-2">
          {meal.items.map((item) => (
            <ItemRow
              key={item.id}
              mealId={meal.id}
              item={item}
              suggested={suggestedIds.has(item.id)}
              builder={builder}
              report={report}
            />
          ))}
        </div>
      )}

      {pickerOpen ? (
        <div className="space-y-2 rounded-lg border border-dashed border-border p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              غذا را انتخاب کنید تا همان لحظه اضافه شود
            </p>
            {meal.items.length > 0 && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setPickerOpen(false)}>
                بستن
              </Button>
            )}
          </div>
          {adding ? (
            <p className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              در حال افزودن...
            </p>
          ) : (
            <FoodSearchSelect value={null} onChange={handlePickFood} />
          )}
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => setPickerOpen(true)}
        >
          <Plus />
          افزودن غذا به {meal.mealName}
        </Button>
      )}

      <NutritionSummaryBar variant="meal" totals={totals} />

      <ConfirmDialog
        open={confirmingRemove}
        onOpenChange={setConfirmingRemove}
        title={`حذف «${meal.mealName}»؟`}
        description={`این وعده و ${toPersianDigits(meal.items.length)} غذای داخلش از برنامه حذف می‌شود.`}
        confirmLabel="حذف وعده"
        errorMessage="حذف وعده با خطا مواجه شد."
        onConfirm={handleRemoveMeal}
      />
    </section>
  );
}

/**
 * The structured builder behind a nutrition plan built meal by meal. Renders
 * once the assignment exists (a draft row is created up front so meals have
 * an id to attach to); everything written here goes straight through
 * NutritionPlanBuilderController, so closing the dialog mid-edit loses nothing.
 *
 * `athleteId` is where the calorie goal comes from; null for a plan
 * pre-assigned to a pending invite, which just gets no suggestions.
 */
export function StructuredNutritionBuilder({
  assignmentId,
  athleteId,
}: {
  assignmentId: string;
  athleteId: string | null;
}) {
  const meals = useNutritionPlanMeals(assignmentId);
  const builder = useNutritionPlanBuilder(assignmentId);
  const athlete = useAthleteProfile(athleteId);
  const tracker = useSaveTracker();
  const [suggestedIds, setSuggestedIds] = useState<Set<string>>(new Set());
  // How many meals the day is split into for suggestions. Until the trainer
  // says, it follows the plan (never below the usual three), so the first
  // food added to a new plan doesn't get the whole day's share.
  const [chosenMealsPerDay, setChosenMealsPerDay] = useState<number | null>(null);

  const list = meals.data ?? NO_MEALS;
  const totals = useNutritionTotals(list);
  const goal = useMemo(() => (athlete.data ? toNutritionGoal(athlete.data) : null), [athlete.data]);

  const mealsPerDay = chosenMealsPerDay ?? Math.max(DEFAULT_MEALS_PER_DAY, list.length);

  const unusedMeals = MEALS.filter((name) => !list.some((meal) => meal.mealName === name));

  async function handleAddMeal(name: string) {
    try {
      await builder.createMeal.mutateAsync(name);
    } catch (error) {
      toast.error(getErrorMessage(error, "افزودن وعده با خطا مواجه شد."));
    }
  }

  if (meals.isLoading) {
    return <p className="text-sm text-muted-foreground">در حال بارگذاری برنامه...</p>;
  }
  if (meals.isError) {
    return <p className="text-sm text-destructive">دریافت وعده‌ها با خطا مواجه شد. دوباره تلاش کنید.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 -mx-1 space-y-1.5 bg-card px-1 pb-2">
        <NutritionSummaryBar variant="day" totals={totals.day} goal={goal} />
        <p
          role="status"
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
        >
          {tracker.saving ? (
            <>
              <Loader2 className="size-3 animate-spin" /> در حال ذخیره...
            </>
          ) : (
            <>
              <Check className="size-3 text-success" /> تغییرات خودکار ذخیره می‌شود
            </>
          )}
        </p>
      </div>

      {goal ? (
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-x-3">
          <p className="min-w-0 flex-1 text-[11px] leading-5 text-muted-foreground">
            مقدار پیشنهادی از روی هدف {formatNumber(goal.dailyCalories)} کالری (پروتئین{" "}
            {toPersianDigits(goal.proteinPercent)}٪ · کربو {toPersianDigits(goal.carbsPercent)}٪ ·
            چربی {toPersianDigits(goal.fatPercent)}٪) محاسبه می‌شود.
          </p>
          <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            روز را به
            <Select
              value={String(mealsPerDay)}
              onValueChange={(value) => setChosenMealsPerDay(Number(value))}
            >
              <SelectTrigger className="h-8 w-16 justify-center px-2 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => (
                  <SelectItem key={count} value={String(count)}>
                    {toPersianDigits(count)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            وعده تقسیم کن
          </label>
        </div>
      ) : (
        <p className="text-[11px] leading-5 text-muted-foreground">
          برای پیشنهاد خودکار مقدار، هدف کالری و درصد درشت‌مغذی ورزشکار را در پروفایلش ثبت کنید.
        </p>
      )}

      {list.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          هنوز وعده‌ای اضافه نشده. از پایین یک وعده انتخاب کنید.
        </p>
      )}

      <div className="space-y-3">
        {list.map((meal) => (
          <MealCard
            key={meal.id}
            meal={meal}
            mealsPerDay={mealsPerDay}
            goal={goal}
            totals={totals.byMeal[meal.id]}
            suggestedIds={suggestedIds}
            onSuggested={(itemId) => setSuggestedIds((current) => new Set(current).add(itemId))}
            builder={builder}
            report={tracker.report}
          />
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">افزودن وعده</p>
        <div className="flex flex-wrap gap-1.5">
          {unusedMeals.map((name) => (
            <Button
              key={name}
              type="button"
              size="sm"
              variant="outline"
              disabled={builder.createMeal.isPending}
              onClick={() => handleAddMeal(name)}
            >
              <Plus />
              {name}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={builder.createMeal.isPending}
            onClick={() => handleAddMeal(`وعده ${toPersianDigits(list.length + 1)}`)}
          >
            {builder.createMeal.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            وعده دلخواه
          </Button>
        </div>
      </div>
    </div>
  );
}
