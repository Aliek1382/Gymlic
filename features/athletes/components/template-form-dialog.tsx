"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
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
import { useSaveTemplate } from "../hooks/use-save-template";
import { insertExerciseLineForDay } from "../utils/workout-plan-text";
import { planSchema, type PlanFormValues } from "../validators/athlete-schemas";
import type { PlanKind } from "../types/athlete-types";
import { WorkoutDayBuilder } from "./workout-day-builder";

const KIND_COPY: Record<
  PlanKind,
  { trigger: string; title: string; description: string }
> = {
  workout: {
    trigger: "قالب تمرینی جدید",
    title: "ساخت قالب برنامه تمرینی",
    description:
      "این قالب فقط برای شما ذخیره می‌شود و بعداً هنگام نوشتن برنامه برای یک ورزشکار قابل استفاده است.",
  },
  nutrition: {
    trigger: "قالب غذایی جدید",
    title: "ساخت قالب برنامه غذایی",
    description:
      "این قالب فقط برای شما ذخیره می‌شود و بعداً هنگام نوشتن برنامه برای یک ورزشکار قابل استفاده است.",
  },
};

export function TemplateFormDialog({ kind }: { kind: PlanKind }) {
  const [open, setOpen] = useState(false);
  const saveTemplate = useSaveTemplate(kind);
  const copy = KIND_COPY[kind];

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: { title: "", description: "" },
  });

  function handleInsertExerciseLine(day: string, line: string) {
    const current = form.getValues("description") ?? "";
    form.setValue("description", insertExerciseLineForDay(current, day, line), {
      shouldDirty: true,
    });
  }

  async function onSubmit(values: PlanFormValues) {
    try {
      await saveTemplate.mutateAsync({
        title: values.title,
        description: values.description || null,
      });
      toast.success("قالب جدید ذخیره شد.");
      handleOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیره قالب با خطا مواجه شد."));
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) form.reset({ title: "", description: "" });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        {copy.trigger}
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`template-${kind}-title`}>عنوان قالب</Label>
            <Input
              id={`template-${kind}-title`}
              placeholder="مثلاً برنامه هفته اول مبتدی"
              {...form.register("title")}
            />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          {kind === "workout" && (
            <WorkoutDayBuilder onInsertLine={handleInsertExerciseLine} />
          )}

          <div className="space-y-2">
            <Label htmlFor={`template-${kind}-description`}>
              توضیحات (اختیاری)
            </Label>
            <textarea
              id={`template-${kind}-description`}
              rows={kind === "workout" ? 5 : 3}
              placeholder="توضیحات آزاد برای شرح حرکات، ست و تکرار یا وعده‌های غذایی..."
              className="w-full rounded-xl border border-input bg-transparent px-4 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
              {...form.register("description")}
            />
          </div>

          <Button type="submit" className="w-full" disabled={saveTemplate.isPending}>
            {saveTemplate.isPending && <Loader2 className="animate-spin" />}
            ذخیره قالب
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
