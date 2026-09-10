"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/get-error-message";
import { useAddMeasurement } from "../hooks/use-add-measurement";

// Same rule the full measurement form validates weight against — kept here
// too since this is a separate, lighter entry point rather than a shared
// field.
const WEIGHT_PATTERN = /^\d+(\.\d+)?$/;

// A single-field shortcut next to the full measurement dialog: most check-ins
// are "just today's weight", and making that a one-tap action is what
// actually gets it logged often enough for the trainer's reports and the
// weight chart to be worth anything.
export function QuickWeightEntry({ athleteId }: { athleteId: string }) {
  const [value, setValue] = useState("");
  const addMeasurement = useAddMeasurement(athleteId);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!WEIGHT_PATTERN.test(trimmed)) {
      toast.error("فقط عدد وارد کنید.");
      return;
    }

    try {
      await addMeasurement.mutateAsync({
        heightCm: null,
        weightKg: Number(trimmed),
        bodyFatPercent: null,
        waistCm: null,
        chestCm: null,
        note: null,
      });
      toast.success("وزن امروز ثبت شد.");
      setValue("");
    } catch (error) {
      toast.error(getErrorMessage(error, "ثبت وزن با خطا مواجه شد."));
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-1 items-center gap-2">
      <Input
        inputMode="decimal"
        placeholder="وزن امروز (کیلوگرم)"
        aria-label="وزن امروز (کیلوگرم)"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="text-center"
      />
      <Button
        type="submit"
        variant="secondary"
        disabled={addMeasurement.isPending || !value.trim()}
      >
        {addMeasurement.isPending && <Loader2 className="animate-spin" />}
        ثبت وزن
      </Button>
    </form>
  );
}
