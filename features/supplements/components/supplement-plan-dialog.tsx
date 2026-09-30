"use client";

import { useState } from "react";
import { Loader2, Pencil, Pill, Trash2 } from "lucide-react";
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
import { MAX_PLAN_ITEMS } from "../constants";
import {
  useCreateSupplementPlan,
  useUpdateSupplementPlan,
} from "../hooks/use-supplement-plan-actions";
import type { SupplementPlan, SupplementPlanItemInput } from "../types/supplement-types";
import { SupplementPicker } from "./supplement-picker";
import { describeTiming } from "./supplement-timing-label";

/** Builds a supplement plan for an athlete, or edits `plan` (its items are replaced as a whole). */
export function SupplementPlanDialog({
  athleteId,
  plan,
}: {
  athleteId: string;
  plan?: SupplementPlan;
}) {
  const createPlan = useCreateSupplementPlan();
  const updatePlan = useUpdateSupplementPlan();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<SupplementPlanItemInput[]>([]);

  const isPending = createPlan.isPending || updatePlan.isPending;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setTitle(plan?.title ?? "");
      setItems(plan?.items ?? []);
    }
  }

  async function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("عنوان برنامه را وارد کنید.");
      return;
    }
    if (items.length === 0) {
      toast.error("حداقل یک مکمل به برنامه اضافه کنید.");
      return;
    }

    const payload = items.map(({ supplementId, supplementName, dose, timing, customTime, note }) => ({
      supplementId,
      supplementName,
      dose,
      timing,
      customTime,
      note,
    }));

    try {
      if (plan) {
        await updatePlan.mutateAsync({ id: plan.id, title: trimmed, items: payload });
        toast.success("برنامه مکمل به‌روز شد.");
      } else {
        await createPlan.mutateAsync({ athleteId, title: trimmed, items: payload });
        toast.success("برنامه مکمل ثبت شد و ورزشکار مطلع می‌شود.");
      }
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "ثبت برنامه مکمل با خطا مواجه شد."));
    }
  }

  return (
    <>
      {plan ? (
        <Button size="sm" variant="outline" onClick={() => handleOpenChange(true)}>
          <Pencil />
          ویرایش
        </Button>
      ) : (
        <Button size="sm" onClick={() => handleOpenChange(true)}>
          <Pill />
          برنامه مکمل جدید
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{plan ? "ویرایش برنامه مکمل" : "برنامه مکمل جدید"}</DialogTitle>
            <DialogDescription>
              مکمل‌ها را با دوز و زمان مصرف اضافه کنید. سر زمان هر مکمل، یک اعلان برای ورزشکار ارسال می‌شود.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supplement-plan-title">عنوان</Label>
              <Input
                id="supplement-plan-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً مکمل‌های فاز حجم"
                maxLength={255}
              />
            </div>

            {items.length > 0 && (
              <ul className="space-y-2">
                {items.map((item, index) => (
                  <li
                    key={`${item.supplementId}-${index}`}
                    className="flex items-start justify-between gap-2 rounded-xl border border-border p-3"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium text-foreground">
                        {item.supplementName} — {item.dose}
                      </p>
                      <p className="text-xs text-muted-foreground">{describeTiming(item)}</p>
                      {item.note && (
                        <p className="text-xs text-muted-foreground">{item.note}</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="حذف از برنامه"
                      onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {items.length >= MAX_PLAN_ITEMS ? (
              <p className="text-xs text-muted-foreground">
                حداکثر {MAX_PLAN_ITEMS} مکمل در هر برنامه.
              </p>
            ) : (
              <SupplementPicker onAdd={(item) => setItems((current) => [...current, item])} />
            )}
          </div>

          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" />}
            {plan ? "ذخیرهٔ تغییرات" : "ثبت برنامه مکمل"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
