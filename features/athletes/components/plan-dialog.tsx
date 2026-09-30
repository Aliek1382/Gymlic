"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { cn } from "@/lib/utils";
import { NutritionFormatHint } from "./nutrition-format-hint";
import { PlanFormatHint } from "./plan-format-hint";
import { PLAN_DESCRIPTION_PLACEHOLDER } from "../constants/athletes";
import { useDeleteTemplate } from "../hooks/use-delete-template";
import { nutritionPlanMealsKey } from "../hooks/use-nutrition-plan-meals";
import { usePlans } from "../hooks/use-plans";
import { useSavePlan } from "../hooks/use-save-plan";
import { useSaveTemplate } from "../hooks/use-save-template";
import { useTemplates } from "../hooks/use-templates";
import { appendLine, insertLineUnderHeading } from "../utils/workout-plan-text";
import { planSchema, type PlanFormValues } from "../validators/athlete-schemas";
import type { PlanKind, PlanTarget } from "../types/athlete-types";
import type { NutritionPlanMeal } from "../types/nutrition-plan-builder-types";
import { NutritionDayBuilder } from "./nutrition-day-builder";
import { StructuredNutritionBuilder } from "./structured-nutrition-builder";
import { StructuredWorkoutBuilder } from "./structured-workout-builder";
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
  // "structured" builds the plan from rows (workout_plan_days, or for a
  // nutrition plan nutrition_plan_meals; no free text at all); "text" is the
  // classic description box, written either through the picker or typed by hand. This only tracks which UI is
  // showing right now — a trainer can flip between all three at any point
  // while drafting and nothing already written is lost, since picker/manual
  // both edit the same description field and a structured draft's rows live
  // in the database, not in this component's state. The only one-way part is
  // the server's: once the assignment actually has structured rows in it,
  // its builder_mode is 'structured' for good (see the compatibility rule in
  // PlanController) — the two are never mixed on one assignment.
  const [builderMode, setBuilderMode] = useState<"text" | "structured">("text");
  const [textMode, setTextMode] = useState<"picker" | "manual">("picker");
  const [creatingStructuredDraft, setCreatingStructuredDraft] = useState(false);
  const queryClient = useQueryClient();
  const athleteId = "athleteId" in target ? target.athleteId : null;
  const plans = usePlans(kind, target, open);
  const savePlan = useSavePlan(kind, target);
  const templates = useTemplates(kind, open);
  const saveTemplate = useSaveTemplate(kind);
  const deleteTemplate = useDeleteTemplate(kind);
  const { title: kindTitle, icon: Icon } = KIND_LABEL[kind];

  // The most recently assigned active plan — highlighted as what the
  // athlete should currently be following. Shifts automatically once a
  // newer active plan is saved, since it's derived from assignedAt.
  const latestPlanId = plans.data?.find((plan) => plan.status === "active")?.id;

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
      setBuilderMode(draft.builderMode);
    }
    setHydrated(true);
  }, [open, hydrated, plans.isLoading, plans.data, form]);

  async function handleStartStructuredDraft() {
    const title = form.getValues("title");
    if (!title.trim()) {
      toast.error("قبل از شروع برنامه ساختاریافته، عنوان را وارد کنید.");
      return;
    }
    setCreatingStructuredDraft(true);
    try {
      const result = await savePlan.mutateAsync({
        title,
        description: null,
        status: "draft",
      });
      setDraftId(result.id);
    } catch (error) {
      toast.error(getErrorMessage(error, "شروع برنامه ساختاریافته با خطا مواجه شد."));
    } finally {
      setCreatingStructuredDraft(false);
    }
  }

  async function onSubmit(values: PlanFormValues, status: "active" | "draft") {
    // A nutrition plan sent as structured with no food in it would reach the
    // athlete as an empty page. (Nothing else stops it: the meals autosave
    // outside this form.)
    if (kind === "nutrition" && builderMode === "structured" && status === "active") {
      const meals = draftId
        ? queryClient.getQueryData<NutritionPlanMeal[]>(nutritionPlanMealsKey(draftId))
        : undefined;
      if (!meals?.some((meal) => meal.items.length > 0)) {
        toast.error("قبل از ثبت نهایی، حداقل یک وعده با یک غذا اضافه کنید.");
        return;
      }
    }

    try {
      const result = await savePlan.mutateAsync({
        id: draftId ?? undefined,
        title: values.title,
        description: builderMode === "structured" ? null : values.description || null,
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

  function handleInsertLine(heading: string | null, line: string) {
    const current = form.getValues("description") ?? "";
    const next = heading
      ? insertLineUnderHeading(current, heading, line)
      : appendLine(current, line);
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
      setBuilderMode("text");
      setTextMode("picker");
      form.reset({ title: "", description: "" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Icon />
        {kindTitle}
      </Button>

      <DialogContent
        className={cn(
          builderMode === "structured" && "sm:max-w-2xl",
          // The meal cards need the width more than the gutter on a phone.
          kind === "nutrition" && builderMode === "structured" && "p-4 sm:p-6"
        )}
      >
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

          <div className="space-y-1.5">
            <Label>روش نوشتن برنامه</Label>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={builderMode === "text" && textMode === "picker" ? "default" : "outline"}
                onClick={() => {
                  setBuilderMode("text");
                  setTextMode("picker");
                }}
              >
                نوشتن با انتخاب‌گر
              </Button>
              <Button
                type="button"
                size="sm"
                variant={builderMode === "text" && textMode === "manual" ? "default" : "outline"}
                onClick={() => {
                  setBuilderMode("text");
                  setTextMode("manual");
                }}
              >
                تایپ دستی
              </Button>
              <Button
                type="button"
                size="sm"
                variant={builderMode === "structured" ? "default" : "outline"}
                onClick={() => setBuilderMode("structured")}
              >
                {kind === "workout"
                  ? "ساخت ساختاریافته (روز به روز)"
                  : "ساخت ساختاریافته (وعده به وعده)"}
              </Button>
            </div>
          </div>

          {builderMode === "structured" ? (
            draftId ? (
              kind === "workout" ? (
                <StructuredWorkoutBuilder assignmentId={draftId} />
              ) : (
                <StructuredNutritionBuilder assignmentId={draftId} athleteId={athleteId} />
              )
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={creatingStructuredDraft}
                onClick={handleStartStructuredDraft}
              >
                {creatingStructuredDraft && <Loader2 className="animate-spin" />}
                شروع ساخت برنامه ساختاریافته
              </Button>
            )
          ) : (
            <>
              {kind === "workout" && textMode === "picker" && (
                <WorkoutDayBuilder onInsertLine={handleInsertLine} />
              )}
              {kind === "nutrition" && textMode === "picker" && (
                <NutritionDayBuilder onInsertLine={handleInsertLine} />
              )}

              <div className="space-y-2">
                <Label htmlFor={`${kind}-description`}>توضیحات (اختیاری)</Label>
                <textarea
                  id={`${kind}-description`}
                  rows={5}
                  placeholder={PLAN_DESCRIPTION_PLACEHOLDER[kind]}
                  className="w-full rounded-xl border border-input bg-transparent px-4 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
                  {...form.register("description")}
                />
                {kind === "workout" && textMode === "manual" && <PlanFormatHint />}
                {kind === "nutrition" && textMode === "manual" && <NutritionFormatHint />}
              </div>
            </>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="submit"
              className="flex-1"
              disabled={
                savePlan.isPending || (builderMode === "structured" && !draftId)
              }
            >
              {savePlan.isPending && <Loader2 className="animate-spin" />}
              ثبت نهایی برنامه
            </Button>
            {builderMode !== "structured" && (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={savePlan.isPending}
                onClick={form.handleSubmit((values) => onSubmit(values, "draft"))}
              >
                بعداً بقیه‌اش را می‌نویسم
              </Button>
            )}
          </div>

          {builderMode !== "structured" && (
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
          )}
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
                  className={cn(
                    "rounded-xl border border-border p-3 text-sm",
                    plan.id === latestPlanId &&
                      "border-primary ring-1 ring-primary/30"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {plan.title}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      {plan.id === latestPlanId && (
                        <Badge variant="info">آخرین برنامه</Badge>
                      )}
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
