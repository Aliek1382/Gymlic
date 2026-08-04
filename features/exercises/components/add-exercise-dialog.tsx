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
import { useCreateExercise } from "../hooks/use-create-exercise";
import {
  addExerciseSchema,
  type AddExerciseFormValues,
} from "../validators/exercise-schemas";

export function AddExerciseDialog() {
  const [open, setOpen] = useState(false);
  const createExercise = useCreateExercise();

  const form = useForm<AddExerciseFormValues>({
    resolver: zodResolver(addExerciseSchema),
    defaultValues: { name: "", muscleGroup: "" },
  });

  async function onSubmit(values: AddExerciseFormValues) {
    try {
      await createExercise.mutateAsync(values);
      toast.success("حرکت جدید به کتابخانه اضافه شد.");
      handleOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "افزودن حرکت با خطا مواجه شد."));
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
        افزودن حرکت جدید
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>افزودن حرکت جدید</DialogTitle>
          <DialogDescription>
            این حرکت فقط برای شما ذخیره می‌شود و در برنامه‌های تمرینی قابل
            استفاده خواهد بود.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="exercise-name">نام حرکت</Label>
            <Input
              id="exercise-name"
              placeholder="مثلاً پرس سینه با هالتر"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="exercise-muscle-group">گروه عضلانی</Label>
            <Input
              id="exercise-muscle-group"
              placeholder="مثلاً سینه، پشت، پا..."
              {...form.register("muscleGroup")}
            />
            {form.formState.errors.muscleGroup && (
              <p className="text-xs text-destructive">
                {form.formState.errors.muscleGroup.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={createExercise.isPending}
          >
            {createExercise.isPending && <Loader2 className="animate-spin" />}
            ثبت حرکت
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
