"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/get-error-message";
import { deleteExercise, updateExercise } from "../services/exercise-service";
import type { ExerciseSummary } from "../types/exercise-types";
import { addExerciseSchema, type AddExerciseFormValues } from "../validators/exercise-schemas";

/**
 * Edit or delete one of the trainer's own exercises. Delete is refused by
 * the server while a plan or template uses the exercise; it frees a place
 * under the plan's cap.
 */
export function CustomExerciseActions({ exercise }: { exercise: ExerciseSummary }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["exercises"] });
    void queryClient.invalidateQueries({ queryKey: ["trainer-billing"] });
  };

  return (
    <>
      <Button size="icon" variant="ghost" className="size-7" aria-label={`ویرایش ${exercise.name}`} onClick={() => setEditing(true)}>
        <Pencil />
      </Button>
      <Button size="icon" variant="ghost" className="size-7" aria-label={`حذف ${exercise.name}`} onClick={() => setDeleting(true)}>
        <Trash2 />
      </Button>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          {editing && <EditForm exercise={exercise} onDone={() => { setEditing(false); refresh(); }} />}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="حذف حرکت"
        description={`«${exercise.name}» از کتابخانهٔ شما حذف شود؟ اگر در برنامه یا قالبی استفاده شده باشد، حذف نمی‌شود.`}
        confirmLabel="حذف"
        errorMessage="حذف حرکت ناموفق بود."
        onConfirm={async () => {
          await deleteExercise(exercise.id);
          toast.success("حرکت حذف شد.");
          refresh();
        }}
      />
    </>
  );
}

function EditForm({ exercise, onDone }: { exercise: ExerciseSummary; onDone: () => void }) {
  const form = useForm<AddExerciseFormValues>({
    resolver: zodResolver(addExerciseSchema),
    defaultValues: {
      name: exercise.name,
      nameEn: exercise.nameEn ?? "",
      description: exercise.description ?? "",
      muscleGroup: exercise.muscleGroup,
    },
  });

  async function onSubmit(values: AddExerciseFormValues) {
    try {
      await updateExercise(exercise.id, {
        name: values.name,
        nameEn: values.nameEn?.trim() || null,
        description: values.description?.trim() || null,
        muscleGroup: values.muscleGroup,
      });
      toast.success("حرکت ویرایش شد.");
      onDone();
    } catch (error) {
      toast.error(getErrorMessage(error, "ویرایش حرکت ناموفق بود."));
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>ویرایش حرکت</DialogTitle>
      </DialogHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="edit-exercise-name">نام حرکت (فارسی)</Label>
          <Input id="edit-exercise-name" {...form.register("name")} />
          {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-exercise-name-en">
            نام انگلیسی <span className="text-muted-foreground">(اختیاری)</span>
          </Label>
          <Input id="edit-exercise-name-en" dir="ltr" {...form.register("nameEn")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-exercise-description">
            توضیح <span className="text-muted-foreground">(اختیاری)</span>
          </Label>
          <textarea
            id="edit-exercise-description"
            rows={3}
            className="w-full rounded-xl border border-input bg-transparent px-4 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
            {...form.register("description")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-exercise-muscle">گروه عضلانی</Label>
          <Input id="edit-exercise-muscle" {...form.register("muscleGroup")} />
          {form.formState.errors.muscleGroup && (
            <p className="text-xs text-destructive">{form.formState.errors.muscleGroup.message}</p>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
          ذخیره
        </Button>
      </form>
    </>
  );
}
