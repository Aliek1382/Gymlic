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
import { useCreateTechnique } from "../hooks/use-create-technique";
import {
  addTechniqueSchema,
  type AddTechniqueFormValues,
} from "../validators/technique-schemas";

export function AddTechniqueDialog({
  onCreated,
}: {
  onCreated?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const createTechnique = useCreateTechnique();

  const form = useForm<AddTechniqueFormValues>({
    resolver: zodResolver(addTechniqueSchema),
    defaultValues: { name: "", description: "" },
  });

  async function onSubmit(values: AddTechniqueFormValues) {
    try {
      const { id } = await createTechnique.mutateAsync({
        name: values.name,
        description: values.description?.trim() || null,
      });
      toast.success("تکنیک جدید ذخیره شد.");
      handleOpenChange(false);
      onCreated?.(id);
    } catch (error) {
      toast.error(getErrorMessage(error, "افزودن تکنیک با خطا مواجه شد."));
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) form.reset();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Plus />
        تکنیک جدید
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>تکنیک جدید</DialogTitle>
          <DialogDescription>
            این تکنیک فقط برای شما ذخیره می‌شود و توضیحش را ورزشکار روی حرکت
            می‌بیند.
          </DialogDescription>
        </DialogHeader>

        {/* React bubbles a portal's submit event up to ancestor forms; the
            picker sits inside larger plan dialogs, so stop it here. */}
        <form
          onSubmit={(event) => {
            event.stopPropagation();
            void form.handleSubmit(onSubmit)(event);
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="technique-name">نام تکنیک</Label>
            <Input
              id="technique-name"
              placeholder="مثلاً دراپ‌ست"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="technique-description">
              توضیح تکنیک{" "}
              <span className="text-muted-foreground">(اختیاری)</span>
            </Label>
            <textarea
              id="technique-description"
              rows={4}
              placeholder="مثلاً بعد از ست آخر، فوراً وزنه را کم کن و بدون استراحت ادامه بده."
              className="w-full rounded-xl border border-input bg-transparent px-4 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
              {...form.register("description")}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={createTechnique.isPending}
          >
            {createTechnique.isPending && <Loader2 className="animate-spin" />}
            ثبت تکنیک
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
