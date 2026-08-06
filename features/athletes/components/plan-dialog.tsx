"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Apple, Bookmark, Dumbbell, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { formatPersianDate } from "@/lib/persian";
import { getErrorMessage } from "@/lib/get-error-message";
import { useDeleteTemplate } from "../hooks/use-delete-template";
import { usePlans } from "../hooks/use-plans";
import { useSavePlan } from "../hooks/use-save-plan";
import { useSaveTemplate } from "../hooks/use-save-template";
import { useTemplates } from "../hooks/use-templates";
import {
  appendExerciseLine,
  insertExerciseLineUnderHeading,
} from "../utils/workout-plan-text";
import { planSchema, type PlanFormValues } from "../validators/athlete-schemas";
import type { PlanKind, PlanTarget } from "../types/athlete-types";
import { WorkoutDayBuilder } from "./workout-day-builder";

const KIND_LABEL: Record<PlanKind, { title: string; icon: typeof Dumbbell }> = {
  workout: { title: "برنامه تمرینی", icon: Dumbbell },
  nutrition: { title: "برنامه غذایی", icon: Apple },
};

export function PlanDialog({
  kind,
  target,
  athleteName,
}: {
  kind: PlanKind;
  target: PlanTarget;
  athleteName: string;
}) {
  const [open, setOpen] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const plans = usePlans(kind, target, open);
  const savePlan = useSavePlan(kind, target);
  const templates = useTemplates(kind, open);
  const saveTemplate = useSaveTemplate(kind);
  const deleteTemplate = useDeleteTemplate(kind);
  const { title: kindTitle, icon: Icon } = KIND_LABEL[kind];

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: { title: "", description: "" },
  });

  // Auto-resume the trainer's most recent unfinished draft (if any) for this
  // athlete once the plan history has loaded, so continuing means editing
  // the same row instead of retyping from scratch.
  useEffect(() => {
    if (!open || hydrated || plans.isLoading) return;
    const draft = plans.data?.find((plan) => plan.status === "draft");
    if (draft) {
      form.reset({ title: draft.title, description: draft.description ?? "" });
      setDraftId(draft.id);
    }
    setHydrated(true);
  }, [open, hydrated, plans.isLoading, plans.data, form]);

  async function onSubmit(values: PlanFormValues, status: "active" | "draft") {
    try {
      const result = await savePlan.mutateAsync({
        id: draftId ?? undefined,
        title: values.title,
        description: values.description || null,
        status,
      });

      if (status === "draft") {
        setDraftId(result.id);
        toast.success("برنامه به‌عنوان پیش‌نویس ذخیره شد.");
      } else {
        form.reset({ title: "", description: "" });
        setDraftId(null);
        toast.success("برنامه با موفقیت ثبت شد.");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "ثبت برنامه با خطا مواجه شد."));
    }
  }

  function handleInsertExerciseLine(heading: string | null, line: string) {
    const current = form.getValues("description") ?? "";
    const next = heading
      ? insertExerciseLineUnderHeading(current, heading, line)
      : appendExerciseLine(current, line);
    form.setValue("description", next, { shouldDirty: true });
  }

  function handleApplyTemplate(template: { title: string; description: string | null }) {
    form.reset({ title: template.title, description: template.description ?? "" });
    toast.success("قالب اعمال شد — قبل از ثبت می‌توانید ویرایش کنید.");
  }

  async function handleSaveAsTemplate() {
    const values = form.getValues();
    if (!values.title.trim()) {
      toast.error("برای ذخیره قالب، عنوان را وارد کنید.");
      return;
    }
    try {
      await saveTemplate.mutateAsync({
        title: values.title,
        description: values.description || null,
      });
      toast.success("به‌عنوان قالب ذخیره شد.");
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیره قالب با خطا مواجه شد."));
    }
  }

  async function handleDeleteTemplate(templateId: string) {
    try {
      await deleteTemplate.mutateAsync(templateId);
    } catch (error) {
      toast.error(getErrorMessage(error, "حذف قالب با خطا مواجه شد."));
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setHydrated(false);
      setDraftId(null);
      form.reset({ title: "", description: "" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Icon />
        {kindTitle}
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {kindTitle} — {athleteName}
          </DialogTitle>
          <DialogDescription>
            {draftId
              ? "شما یک پیش‌نویس ناتمام دارید — از همین‌جا ادامه دهید."
              : "یک برنامه جدید برای این ورزشکار ثبت کنید."}
          </DialogDescription>
        </DialogHeader>

        {templates.data && templates.data.length > 0 && (
          <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">
              شروع از یک قالب
            </p>
            <div className="flex flex-wrap gap-2">
              {templates.data.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center gap-1 rounded-full bg-muted pr-1 pl-2"
                >
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate(template)}
                    className="rounded-full px-2 py-1 text-xs font-medium text-foreground hover:text-primary"
                  >
                    {template.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTemplate(template.id)}
                    aria-label="حذف قالب"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={form.handleSubmit((values) => onSubmit(values, "active"))}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor={`${kind}-title`}>عنوان برنامه</Label>
            <Input
              id={`${kind}-title`}
              placeholder="مثلاً برنامه هفته اول"
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
            <Label htmlFor={`${kind}-description`}>توضیحات (اختیاری)</Label>
            <textarea
              id={`${kind}-description`}
              rows={kind === "workout" ? 5 : 3}
              placeholder="توضیحات آزاد برای شرح حرکات، ست و تکرار یا وعده‌های غذایی..."
              className="w-full rounded-xl border border-input bg-transparent px-4 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
              {...form.register("description")}
            />
            {kind === "workout" && (
              <p className="text-xs text-muted-foreground">
                اگر درمورد سیستم انجام دادن حرکات توضیحی دارید اضافه کنید،
                مثل انجام حرکت به شکل سوپر ست یا دراپ ست و ...
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="submit"
              className="flex-1"
              disabled={savePlan.isPending}
            >
              {savePlan.isPending && <Loader2 className="animate-spin" />}
              ثبت نهایی برنامه
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={savePlan.isPending}
              onClick={form.handleSubmit((values) => onSubmit(values, "draft"))}
            >
              بعداً بقیه‌اش را می‌نویسم
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            disabled={saveTemplate.isPending}
            onClick={handleSaveAsTemplate}
          >
            {saveTemplate.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Bookmark />
            )}
            ذخیره به‌عنوان قالب
          </Button>
        </form>

        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-sm font-medium text-foreground">
            برنامه‌های قبلی
          </p>
          {plans.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : plans.data && plans.data.length > 0 ? (
            <div className="max-h-40 space-y-2 overflow-y-auto">
              {plans.data.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-xl border border-border p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {plan.title}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      {plan.status === "draft" && (
                        <Badge variant="warning">پیش‌نویس</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatPersianDate(new Date(plan.assignedAt))}
                      </span>
                    </div>
                  </div>
                  {plan.description && (
                    <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">
                      {plan.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              هنوز برنامه‌ای ثبت نشده است.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
