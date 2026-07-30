"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Apple, Dumbbell, Loader2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { formatPersianDate } from "@/lib/persian";
import { getErrorMessage } from "@/lib/get-error-message";
import { usePlans } from "../hooks/use-plans";
import { useCreatePlan } from "../hooks/use-create-plan";
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
  const plans = usePlans(kind, target, open);
  const createPlan = useCreatePlan(kind, target);
  const { title: kindTitle, icon: Icon } = KIND_LABEL[kind];

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: { title: "", description: "" },
  });

  async function onSubmit(values: PlanFormValues) {
    try {
      await createPlan.mutateAsync({
        title: values.title,
        description: values.description || null,
      });
      form.reset();
      toast.success("برنامه با موفقیت ثبت شد.");
    } catch (error) {
      toast.error(getErrorMessage(error, "ثبت برنامه با خطا مواجه شد."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            یک برنامه جدید برای این ورزشکار ثبت کنید.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

          <div className="space-y-2">
            <Label htmlFor={`${kind}-description`}>توضیحات (اختیاری)</Label>
            <textarea
              id={`${kind}-description`}
              rows={3}
              placeholder="توضیحات آزاد برای شرح حرکات، ست و تکرار یا وعده‌های غذایی..."
              className="w-full rounded-xl border border-input bg-transparent px-4 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
              {...form.register("description")}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={createPlan.isPending}
          >
            {createPlan.isPending && <Loader2 className="animate-spin" />}
            ثبت برنامه
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
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">
                      {plan.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatPersianDate(new Date(plan.assignedAt))}
                    </span>
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
