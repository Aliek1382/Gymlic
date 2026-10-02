"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
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
import { formatNumber } from "@/lib/persian";
import { createPlan, updatePlan } from "../services/admin-service";
import { listPlanAccounts } from "../services/plan-accounts-service";
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
    /** undefined before the plan-limits database update. */
    maxTrainers?: number | null;
  };
  /** Whether the plan-limits columns exist (the catalogue sends max_trainers). */
  withTrainerCap?: boolean;
}

export function PlanFormDialog({ plan, withTrainerCap = false }: PlanFormDialogProps) {
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
      maxTrainers: plan?.maxTrainers != null ? String(plan.maxTrainers) : "",
    },
  });

  // Before saving a lower cap: how many clubs on this plan it leaves above it.
  const watched = useWatch({ control: form.control, name: ["maxMembers", "maxTrainers"] });
  const accounts = useQuery({
    queryKey: ["admin", "plan-accounts"],
    queryFn: listPlanAccounts,
    enabled: open && isEdit && withTrainerCap,
  });
  const newMembers = watched[0] ? Number(watched[0]) : null;
  const newTrainers = watched[1] ? Number(watched[1]) : null;
  const capsChanged =
    isEdit && (newMembers !== (plan.maxMembers ?? null) || newTrainers !== (plan.maxTrainers ?? null));
  const onPlan = (accounts.data?.clubs ?? []).filter((c) => plan && c.limits.plan_id === plan.id && !c.limits.override);
  const affected = onPlan.filter(
    (c) =>
      (newMembers !== null && c.limits.usage.members > newMembers) ||
      (newTrainers !== null && c.limits.usage.trainers > newTrainers)
  ).length;

  async function onSubmit(values: PlanFormValues) {
    const maxMembers = values.maxMembers ? Number(values.maxMembers) : null;
    const maxTrainers = withTrainerCap ? (values.maxTrainers ? Number(values.maxTrainers) : null) : undefined;
    const input = { ...values, maxMembers, maxTrainers };
    try {
      if (isEdit) {
        await updatePlan(plan.id, input);
        toast.success("پلن به‌روزرسانی شد.");
      } else {
        await createPlan(input);
        toast.success("پلن جدید ثبت شد.");
        form.reset({ name: "", priceToman: 0, durationDays: 30, maxMembers: "", maxTrainers: "" });
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

          {withTrainerCap && (
            <div className="space-y-2">
              <Label htmlFor="plan-max-trainers">سقف تعداد مربی (اختیاری)</Label>
              <Input
                id="plan-max-trainers"
                type="number"
                dir="ltr"
                placeholder="بدون محدودیت"
                {...form.register("maxTrainers")}
              />
              {form.formState.errors.maxTrainers && (
                <p className="text-xs text-destructive">{form.formState.errors.maxTrainers.message}</p>
              )}
            </div>
          )}

          {withTrainerCap && (
            <p className="text-xs leading-5 text-muted-foreground">
              تغییر قیمت از خرید بعدی اعمال می‌شود؛ تغییر سقف‌ها برای همهٔ باشگاه‌های این پلن فوراً اعمال می‌شود.
            </p>
          )}
          {capsChanged && accounts.data?.ready && (
            <p className="rounded-xl bg-info-muted px-3 py-2 text-xs leading-5 text-foreground">
              {formatNumber(onPlan.length)} باشگاه الان روی این پلن هستند (بدون سقف دستی).{" "}
              {affected > 0
                ? `با سقف تازه، ${formatNumber(affected)} باشگاه بالای سقف می‌مانند: کسی حذف یا غیرفعال نمی‌شود، فقط دعوت تازه بسته می‌شود.`
                : "با سقف تازه کسی بالای سقف نمی‌ماند."}
            </p>
          )}

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
