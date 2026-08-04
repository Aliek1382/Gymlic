"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Apple, Dumbbell, Loader2 } from "lucide-react";
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
import { ExercisePicker } from "@/features/exercises";
import { usePlans } from "../hooks/use-plans";
import { useSavePlan } from "../hooks/use-save-plan";
import { planSchema, type PlanFormValues } from "../validators/athlete-schemas";
import type { PlanKind, PlanTarget } from "../types/athlete-types";

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

  function handleInsertExerciseLine(line: string) {
    const current = form.getValues("description") ?? "";
    form.setValue("description", current.trim() ? `${current}\n${line}` : line, {
      shouldDirty: true,
    });
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
            <ExercisePicker onInsert={handleInsertExerciseLine} />
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
                    <p className="mt-1 text-xs text-muted-foreground">
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
