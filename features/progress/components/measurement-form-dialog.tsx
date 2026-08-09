"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/get-error-message";
import { useAddMeasurement } from "../hooks/use-add-measurement";
import { useUpdateMeasurement } from "../hooks/use-update-measurement";
import type { MeasurementEntry, MeasurementInput } from "../types/progress-types";
import {
  measurementFormSchema,
  type MeasurementFormValues,
} from "../validators/progress-schemas";

function toInput(values: MeasurementFormValues): MeasurementInput {
  return {
    heightCm: values.heightCm ? Number(values.heightCm) : null,
    weightKg: values.weightKg ? Number(values.weightKg) : null,
    bodyFatPercent: values.bodyFatPercent ? Number(values.bodyFatPercent) : null,
    waistCm: values.waistCm ? Number(values.waistCm) : null,
    chestCm: values.chestCm ? Number(values.chestCm) : null,
    note: values.note?.trim() || null,
  };
}

export function MeasurementFormDialog({
  athleteId,
  entry,
  latestKnownHeight,
}: {
  athleteId: string;
  entry?: MeasurementEntry;
  latestKnownHeight?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const addMeasurement = useAddMeasurement(athleteId);
  const updateMeasurement = useUpdateMeasurement(athleteId);
  const isEdit = Boolean(entry);
  const isPending = addMeasurement.isPending || updateMeasurement.isPending;

  const form = useForm<MeasurementFormValues>({
    resolver: zodResolver(measurementFormSchema),
    defaultValues: { heightCm: "", weightKg: "", bodyFatPercent: "", waistCm: "", chestCm: "", note: "" },
  });

  // Re-seed the form every time the dialog opens rather than only at mount —
  // for "add" this pre-fills height with whatever was last recorded (height
  // rarely changes, so re-typing it each time would be needless friction);
  // for "edit" it loads that specific entry's values.
  useEffect(() => {
    if (!open) return;
    form.reset({
      heightCm: (entry?.heightCm ?? latestKnownHeight)?.toString() ?? "",
      weightKg: entry?.weightKg?.toString() ?? "",
      bodyFatPercent: entry?.bodyFatPercent?.toString() ?? "",
      waistCm: entry?.waistCm?.toString() ?? "",
      chestCm: entry?.chestCm?.toString() ?? "",
      note: entry?.note ?? "",
    });
  }, [open, entry, latestKnownHeight, form]);

  async function onSubmit(values: MeasurementFormValues) {
    try {
      const input = toInput(values);
      if (isEdit && entry) {
        await updateMeasurement.mutateAsync({ id: entry.id, input });
        toast.success("اندازه‌گیری ویرایش شد.");
      } else {
        await addMeasurement.mutateAsync(input);
        toast.success("اندازه‌گیری جدید ثبت شد.");
      }
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "ثبت اندازه‌گیری با خطا مواجه شد."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isEdit ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 shrink-0 text-muted-foreground"
          aria-label="ویرایش اندازه‌گیری"
          onClick={() => setOpen(true)}
        >
          <Pencil className="size-4" />
        </Button>
      ) : (
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus />
          ثبت اندازه‌گیری جدید
        </Button>
      )}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "ویرایش اندازه‌گیری" : "ثبت اندازه‌گیری جدید"}
          </DialogTitle>
          <DialogDescription>
            هر کدام از مقادیر را که در دسترس دارید وارد کنید — نیازی به پر
            کردن همه نیست.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="measurement-weight">وزن (کیلوگرم)</Label>
              <Input
                id="measurement-weight"
                inputMode="decimal"
                className="text-center"
                {...form.register("weightKg")}
              />
              {form.formState.errors.weightKg && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.weightKg.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="measurement-height">
                قد (سانتی‌متر){" "}
                <span className="text-muted-foreground">(معمولاً فقط یک‌بار لازم است)</span>
              </Label>
              <Input
                id="measurement-height"
                inputMode="decimal"
                className="text-center"
                {...form.register("heightCm")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="measurement-bodyfat">درصد چربی بدن</Label>
              <Input
                id="measurement-bodyfat"
                inputMode="decimal"
                className="text-center"
                {...form.register("bodyFatPercent")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="measurement-waist">دور کمر (سانتی‌متر)</Label>
              <Input
                id="measurement-waist"
                inputMode="decimal"
                className="text-center"
                {...form.register("waistCm")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="measurement-chest">دور سینه (سانتی‌متر)</Label>
              <Input
                id="measurement-chest"
                inputMode="decimal"
                className="text-center"
                {...form.register("chestCm")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="measurement-note">یادداشت (اختیاری)</Label>
            <Input id="measurement-note" {...form.register("note")} />
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" />}
            {isEdit ? "ذخیره تغییرات" : "ثبت اندازه‌گیری"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
