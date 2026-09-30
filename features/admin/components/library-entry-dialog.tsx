"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/get-error-message";
import { parseLocaleNumber } from "@/lib/persian";
import { FOOD_UNITS } from "@/features/foods/constants/foods";
import {
  createLibraryEntry,
  updateLibraryEntry,
  type AdminLibraryEntry,
  type LibraryEntryInput,
  type LibraryKind,
} from "../services/admin-library-service";

export const KIND_LABEL: Record<LibraryKind, string> = {
  exercises: "حرکت",
  foods: "غذا",
  supplements: "مکمل",
};

const TEXTAREA_CLASS =
  "w-full rounded-xl border border-input bg-transparent px-4 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

const MACROS = [
  { key: "calories_per_unit", label: "کالری", max: 99999.99 },
  { key: "protein_g", label: "پروتئین (گرم)", max: 9999.99 },
  { key: "carbs_g", label: "کربوهیدرات (گرم)", max: 9999.99 },
  { key: "fat_g", label: "چربی (گرم)", max: 9999.99 },
] as const;

type MacroKey = (typeof MACROS)[number]["key"];

/**
 * Macros are stored per ONE default_unit, so a food counted in grams holds
 * per-gram figures like 0.027 that nobody can type or check. For grams the
 * form works per 100 g — the same way trainers see it — and converts.
 */
function macroFactor(unit: string): number {
  return unit.trim() === "گرم" ? 100 : 1;
}

/** At most 2 decimals, without float noise like 2.7000000000000003. */
function formatMacroInput(value: number): string {
  return String(Math.round(value * 100) / 100);
}

interface Draft {
  name: string;
  name_en: string;
  description: string;
  muscle_group: string;
  category: string;
  default_unit: string;
  calories_per_unit: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
}

function toDraft(entry?: AdminLibraryEntry): Draft {
  const factor = macroFactor(entry?.default_unit ?? "گرم");
  const num = (value: number | null | undefined) =>
    value == null ? "" : formatMacroInput(value * factor);
  return {
    name: entry?.name ?? "",
    name_en: entry?.name_en ?? "",
    description: entry?.description ?? "",
    muscle_group: entry?.muscle_group ?? "",
    category: entry?.category ?? "",
    default_unit: entry?.default_unit ?? "گرم",
    calories_per_unit: num(entry?.calories_per_unit),
    protein_g: num(entry?.protein_g),
    carbs_g: num(entry?.carbs_g),
    fat_g: num(entry?.fat_g),
  };
}

/** The payload for the kind, or an error message for the first bad field. */
function toInput(kind: LibraryKind, draft: Draft): LibraryEntryInput | string {
  const text = (value: string) => value.trim() || null;
  if (draft.name.trim().length < 2) return "نام باید حداقل ۲ حرف باشد.";

  const input: LibraryEntryInput = {
    name: draft.name.trim(),
    name_en: text(draft.name_en),
    description: text(draft.description),
  };

  if (kind === "exercises") {
    if (!draft.muscle_group.trim()) return "گروه عضلانی را وارد کنید.";
    input.muscle_group = draft.muscle_group.trim();
  }

  if (kind === "foods") {
    if (!draft.category.trim()) return "دسته غذایی را وارد کنید.";
    if (!draft.default_unit.trim()) return "واحد پیش‌فرض را وارد کنید.";
    input.category = draft.category.trim();
    input.default_unit = draft.default_unit.trim();
    const factor = macroFactor(input.default_unit);
    for (const macro of MACROS) {
      const raw = draft[macro.key].trim();
      if (!raw) {
        input[macro.key] = null;
        continue;
      }
      const value = parseLocaleNumber(raw);
      if (value === null || value < 0 || value / factor > macro.max) {
        return `${macro.label} باید عددی مثبت و در محدودهٔ مجاز باشد.`;
      }
      // The columns keep 4 decimals; rounding here keeps float noise out.
      input[macro.key] = Math.round((value / factor) * 10_000) / 10_000;
    }
  }

  return input;
}

export function LibraryEntryDialog({
  kind,
  entry,
  suggestions,
  onSaved,
}: {
  kind: LibraryKind;
  /** Omit to add a new entry to the shared bank. */
  entry?: AdminLibraryEntry;
  /** Existing muscle groups / food categories, offered as the admin types. */
  suggestions: string[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(entry));
  const [saving, setSaving] = useState(false);
  const isEdit = !!entry;
  const label = KIND_LABEL[kind];
  const listId = `library-suggestions-${kind}`;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function handleOpenChange(next: boolean) {
    if (next) setDraft(toDraft(entry));
    setOpen(next);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const input = toInput(kind, draft);
    if (typeof input === "string") {
      toast.error(input);
      return;
    }
    setSaving(true);
    try {
      if (entry) {
        await updateLibraryEntry(kind, entry.id, input);
        toast.success(`${label} ویرایش شد.`);
      } else {
        await createLibraryEntry(kind, input);
        toast.success(`${label} به بانک عمومی اضافه شد.`);
      }
      setOpen(false);
      onSaved();
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیره با خطا مواجه شد."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button size="sm" variant="outline">
            <Pencil />
            ویرایش
          </Button>
        ) : (
          <Button>
            <Plus />
            {label} جدید
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `ویرایش ${label}` : `${label} جدید در بانک عمومی`}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lib-name">نام</Label>
              <Input id="lib-name" value={draft.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lib-name-en">
                نام انگلیسی <span className="text-muted-foreground">(اختیاری)</span>
              </Label>
              <Input
                id="lib-name-en"
                dir="ltr"
                value={draft.name_en}
                onChange={(e) => set("name_en", e.target.value)}
              />
            </div>
          </div>

          {kind === "exercises" && (
            <div className="space-y-2">
              <Label htmlFor="lib-muscle">گروه عضلانی</Label>
              <Input
                id="lib-muscle"
                list={listId}
                value={draft.muscle_group}
                onChange={(e) => set("muscle_group", e.target.value)}
              />
            </div>
          )}

          {kind === "foods" && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="lib-category">دسته غذایی</Label>
                  <Input
                    id="lib-category"
                    list={listId}
                    value={draft.category}
                    onChange={(e) => set("category", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lib-unit">واحد پیش‌فرض</Label>
                  <Input
                    id="lib-unit"
                    list="library-food-units"
                    value={draft.default_unit}
                    onChange={(e) => set("default_unit", e.target.value)}
                  />
                  <datalist id="library-food-units">
                    {FOOD_UNITS.map((unit) => (
                      <option key={unit} value={unit} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  ارزش غذایی برای{" "}
                  {macroFactor(draft.default_unit) === 100
                    ? "۱۰۰ گرم"
                    : `یک ${draft.default_unit.trim() || "واحد"}`}{" "}
                  <span className="font-normal text-muted-foreground">(اختیاری)</span>
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {MACROS.map((macro) => (
                    <div key={macro.key} className="space-y-1">
                      <Label htmlFor={`lib-${macro.key}`} className="text-xs">
                        {macro.label}
                      </Label>
                      <Input
                        id={`lib-${macro.key}`}
                        dir="ltr"
                        inputMode="decimal"
                        value={draft[macro.key as MacroKey]}
                        onChange={(e) => set(macro.key as MacroKey, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <datalist id={listId}>
            {suggestions.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>

          <div className="space-y-2">
            <Label htmlFor="lib-description">
              توضیح <span className="text-muted-foreground">(اختیاری)</span>
            </Label>
            <textarea
              id="lib-description"
              rows={3}
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              className={TEXTAREA_CLASS}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {isEdit ? "ذخیره تغییرات" : "افزودن"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
