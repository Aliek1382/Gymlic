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
import { useCreateSupplement } from "../hooks/use-create-supplement";
import {
  addSupplementSchema,
  type AddSupplementFormValues,
} from "../validators/supplement-schemas";

export function AddSupplementDialog() {
  const [open, setOpen] = useState(false);
  const createSupplement = useCreateSupplement();

  const form = useForm<AddSupplementFormValues>({
    resolver: zodResolver(addSupplementSchema),
    defaultValues: { name: "", nameEn: "", description: "" },
  });

  async function onSubmit(values: AddSupplementFormValues) {
    try {
      await createSupplement.mutateAsync({
        name: values.name,
        nameEn: values.nameEn?.trim() || null,
        description: values.description?.trim() || null,
      });
      toast.success("مکمل جدید به کتابخانه اضافه شد.");
      handleOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "افزودن مکمل با خطا مواجه شد."));
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) form.reset();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        افزودن مکمل جدید
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>افزودن مکمل جدید</DialogTitle>
          <DialogDescription>
            این مکمل فقط برای شما ذخیره می‌شود و در برنامه‌های مکمل قابل استفاده
            خواهد بود.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supplement-name">نام مکمل (فارسی)</Label>
            <Input
              id="supplement-name"
              placeholder="مثلاً کراتین مونوهیدرات"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplement-name-en">
              نام انگلیسی <span className="text-muted-foreground">(اختیاری)</span>
            </Label>
            <Input
              id="supplement-name-en"
              dir="ltr"
              placeholder="e.g. Creatine Monohydrate"
              {...form.register("nameEn")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplement-description">
              توضیح <span className="text-muted-foreground">(اختیاری)</span>
            </Label>
            <textarea
              id="supplement-description"
              rows={3}
              placeholder="نکات مصرف، برند پیشنهادی..."
              className="w-full rounded-xl border border-input bg-transparent px-4 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
              {...form.register("description")}
            />
          </div>

          <Button type="submit" className="w-full" disabled={createSupplement.isPending}>
            {createSupplement.isPending && <Loader2 className="animate-spin" />}
            ثبت مکمل
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
