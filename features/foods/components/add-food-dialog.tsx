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
import { parseLocaleNumber } from "@/lib/persian";
import { useCreateFood } from "../hooks/use-create-food";
import { addFoodSchema, type AddFoodFormValues } from "../validators/food-schemas";

function MacroField({
  id,
  label,
  error,
  ...inputProps
}: { id: string; label: string; error?: string } & React.ComponentProps<"input">) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        inputMode="decimal"
        dir="ltr"
        placeholder="مثلاً ۲۰"
        className="text-center"
        {...inputProps}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function AddFoodDialog() {
  const [open, setOpen] = useState(false);
  const createFood = useCreateFood();

  const form = useForm<AddFoodFormValues>({
    resolver: zodResolver(addFoodSchema),
    defaultValues: {
      name: "",
      nameEn: "",
      description: "",
      category: "",
      defaultUnit: "",
      caloriesPerUnit: "",
      proteinG: "",
      carbsG: "",
      fatG: "",
    },
  });

  async function onSubmit(values: AddFoodFormValues) {
    try {
      await createFood.mutateAsync({
        name: values.name,
        nameEn: values.nameEn?.trim() || null,
        description: values.description?.trim() || null,
        category: values.category,
        defaultUnit: values.defaultUnit,
        caloriesPerUnit: parseLocaleNumber(values.caloriesPerUnit ?? ""),
        proteinG: parseLocaleNumber(values.proteinG ?? ""),
        carbsG: parseLocaleNumber(values.carbsG ?? ""),
        fatG: parseLocaleNumber(values.fatG ?? ""),
      });
      toast.success("غذای جدید به کتابخانه اضافه شد.");
      handleOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "افزودن غذا با خطا مواجه شد."));
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
        افزودن غذای جدید
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>افزودن غذای جدید</DialogTitle>
          <DialogDescription>
            این غذا فقط برای شما ذخیره می‌شود و در برنامه‌های غذایی قابل استفاده
            خواهد بود.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="food-name">نام غذا (فارسی)</Label>
            <Input
              id="food-name"
              placeholder="مثلاً سینه مرغ گریل‌شده"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="food-name-en">
              نام انگلیسی غذا{" "}
              <span className="text-muted-foreground">(اختیاری)</span>
            </Label>
            <Input
              id="food-name-en"
              dir="ltr"
              placeholder="e.g. Grilled Chicken Breast"
              {...form.register("nameEn")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="food-description">
              توضیح غذا{" "}
              <span className="text-muted-foreground">(اختیاری)</span>
            </Label>
            <textarea
              id="food-description"
              rows={3}
              placeholder="نکات آماده‌سازی یا مصرف..."
              className="w-full rounded-xl border border-input bg-transparent px-4 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
              {...form.register("description")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="food-category">دسته غذایی</Label>
            <Input
              id="food-category"
              placeholder="مثلاً منابع پروتئینی، سبزیجات، لبنیات..."
              {...form.register("category")}
            />
            {form.formState.errors.category && (
              <p className="text-xs text-destructive">
                {form.formState.errors.category.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="food-default-unit">واحد پیش‌فرض</Label>
            <Input
              id="food-default-unit"
              placeholder="مثلاً گرم، عدد، لیوان، اسکوپ..."
              {...form.register("defaultUnit")}
            />
            {form.formState.errors.defaultUnit && (
              <p className="text-xs text-destructive">
                {form.formState.errors.defaultUnit.message}
              </p>
            )}
          </div>

          <fieldset className="space-y-3 rounded-xl border border-border p-3">
            <legend className="px-1 text-xs font-medium text-muted-foreground">
              ارزش غذایی (اختیاری)
            </legend>
            <p className="text-xs leading-5 text-muted-foreground">
              مقادیر را به‌ازای <strong className="text-foreground">یک واحد پیش‌فرض</strong>{" "}
              بنویسید؛ مثلاً اگر واحد «۱۰۰ گرم» است، کالری و درشت‌مغذی‌ها هم برای
              همان ۱۰۰ گرم باشد. خالی بماند، در جمع برنامه صفر حساب می‌شود.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <MacroField
                id="food-calories"
                label="کالری"
                error={form.formState.errors.caloriesPerUnit?.message}
                {...form.register("caloriesPerUnit")}
              />
              <MacroField
                id="food-protein"
                label="پروتئین (گرم)"
                error={form.formState.errors.proteinG?.message}
                {...form.register("proteinG")}
              />
              <MacroField
                id="food-carbs"
                label="کربوهیدرات (گرم)"
                error={form.formState.errors.carbsG?.message}
                {...form.register("carbsG")}
              />
              <MacroField
                id="food-fat"
                label="چربی (گرم)"
                error={form.formState.errors.fatG?.message}
                {...form.register("fatG")}
              />
            </div>
          </fieldset>

          <Button type="submit" className="w-full" disabled={createFood.isPending}>
            {createFood.isPending && <Loader2 className="animate-spin" />}
            ثبت غذا
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
