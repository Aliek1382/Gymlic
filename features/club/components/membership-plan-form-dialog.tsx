"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber, normalizeAmount, toAsciiDigits } from "@/lib/persian";
import { useSaveMembershipPlan } from "../hooks/use-save-membership-plan";
import type { MembershipPlan } from "../types/club-types";
import {
  membershipPlanSchema,
  type MembershipPlanFormValues,
} from "../validators/club-schemas";

function toDefaults(plan?: MembershipPlan): MembershipPlanFormValues {
  return {
    name: plan?.name ?? "",
    priceToman: plan ? String(plan.priceToman) : "",
    durationDays: plan ? String(plan.durationDays) : "30",
    description: plan?.description ?? "",
    isActive: plan?.isActive ?? true,
  };
}

/** Creates a plan, or edits an existing one when `plan` is given. */
export function MembershipPlanFormDialog({
  clubId,
  plan,
}: {
  clubId: string;
  plan?: MembershipPlan;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = !!plan;
  const savePlan = useSaveMembershipPlan(clubId);

  const form = useForm<MembershipPlanFormValues>({
    resolver: zodResolver(membershipPlanSchema),
    defaultValues: toDefaults(plan),
  });

  const { reset } = form;
  useEffect(() => {
    if (open) reset(toDefaults(plan));
  }, [open, plan, reset]);

  const priceValue = form.watch("priceToman");
  const normalizedPrice = normalizeAmount(priceValue ?? "");

  async function onSubmit(values: MembershipPlanFormValues) {
    try {
      await savePlan.mutateAsync({
        planId: plan?.id,
        input: {
          name: values.name,
          priceToman: Number(normalizeAmount(values.priceToman)),
          durationDays: Number(toAsciiDigits(values.durationDays)),
          description: values.description?.trim() || null,
          isActive: values.isActive,
        },
      });
      toast.success(isEdit ? "طرح به‌روزرسانی شد." : "طرح جدید ساخته شد.");
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیره طرح با خطا مواجه شد."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isEdit ? (
        <Button
          size="icon"
          variant="ghost"
          aria-label={`ویرایش طرح ${plan.name}`}
          onClick={() => setOpen(true)}
        >
          <Pencil />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus />
          طرح جدید
        </Button>
      )}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "ویرایش طرح" : "طرح عضویت جدید"}</DialogTitle>
          <DialogDescription>
            طرح‌های عضویت باشگاه شما در فرم افزودن عضو و در پروفایل هر عضو
            نمایش داده می‌شوند.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="plan-name">نام طرح</Label>
            <Input
              id="plan-name"
              placeholder="مثلاً اشتراک سه‌ماهه"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="plan-price">قیمت (تومان)</Label>
              <Input
                id="plan-price"
                dir="ltr"
                inputMode="numeric"
                placeholder="۵۰۰۰۰۰"
                className="text-center"
                {...form.register("priceToman")}
              />
              {normalizedPrice && /^\d+$/.test(normalizedPrice) && (
                <p className="text-xs text-muted-foreground">
                  {formatNumber(Number(normalizedPrice))} تومان
                </p>
              )}
              {form.formState.errors.priceToman && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.priceToman.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan-duration">مدت (روز)</Label>
              <Input
                id="plan-duration"
                dir="ltr"
                inputMode="numeric"
                placeholder="۳۰"
                className="text-center"
                {...form.register("durationDays")}
              />
              {form.formState.errors.durationDays && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.durationDays.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan-description">توضیحات (اختیاری)</Label>
            <Input
              id="plan-description"
              placeholder="مثلاً شامل استفاده از سونا و استخر"
              {...form.register("description")}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="plan-active">طرح فعال است</Label>
              <p className="text-xs text-muted-foreground">
                طرح غیرفعال برای اعضای فعلی باقی می‌ماند ولی هنگام افزودن عضو
                جدید پیشنهاد نمی‌شود.
              </p>
            </div>
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <Switch
                  id="plan-active"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={savePlan.isPending}>
              {savePlan.isPending && <Loader2 className="animate-spin" />}
              {isEdit ? "ذخیره تغییرات" : "ساخت طرح"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              انصراف
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
