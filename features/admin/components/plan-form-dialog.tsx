"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
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
import { createPlan, updatePlan } from "../services/admin-service";
import {
  planFormSchema,
  type PlanFormInput,
  type PlanFormValues,
} from "../validators/admin-schemas";

interface PlanFormDialogProps {
  plan?: {
    id: string;
    name: string;
    priceToman: number;
    durationDays: number;
    maxMembers: number | null;
  };
}

export function PlanFormDialog({ plan }: PlanFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEdit = !!plan;

  const form = useForm<PlanFormInput, unknown, PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      name: plan?.name ?? "",
      priceToman: plan?.priceToman ?? 0,
      durationDays: plan?.durationDays ?? 30,
      maxMembers: plan?.maxMembers != null ? String(plan.maxMembers) : "",
    },
  });

  async function onSubmit(values: PlanFormValues) {
    const maxMembers = values.maxMembers ? Number(values.maxMembers) : null;
    try {
      if (isEdit) {
        await updatePlan(plan.id, { ...values, maxMembers });
        toast.success("پلن به‌روزرسانی شد.");
      } else {
        await createPlan({ ...values, maxMembers });
        toast.success("پلن جدید ثبت شد.");
        form.reset({ name: "", priceToman: 0, durationDays: 30, maxMembers: "" });
      }
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, "ثبت پلن با خطا مواجه شد."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button size="sm" variant="outline">
            <Pencil />
            ویرایش
          </Button>
        ) : (
          <Button>
            <Plus />
            پلن جدید
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "ویرایش پلن" : "پلن جدید"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="plan-name">نام پلن</Label>
            <Input id="plan-name" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plan-price">قیمت (تومان)</Label>
              <Input
                id="plan-price"
                type="number"
                dir="ltr"
                {...form.register("priceToman")}
              />
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
                type="number"
                dir="ltr"
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
            <Label htmlFor="plan-max-members">سقف تعداد عضو (اختیاری)</Label>
            <Input
              id="plan-max-members"
              type="number"
              dir="ltr"
              placeholder="بدون محدودیت"
              {...form.register("maxMembers")}
            />
            {form.formState.errors.maxMembers && (
              <p className="text-xs text-destructive">
                {form.formState.errors.maxMembers.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
              {isEdit ? "ذخیره تغییرات" : "ثبت پلن"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
