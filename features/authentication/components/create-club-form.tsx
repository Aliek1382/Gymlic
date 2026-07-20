"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateClub } from "../hooks/use-create-club";
import {
  createClubSchema,
  type CreateClubFormValues,
} from "../validators/auth-schemas";

export function CreateClubForm({ skippable }: { skippable?: boolean }) {
  const router = useRouter();
  const createClub = useCreateClub();

  const form = useForm<CreateClubFormValues>({
    resolver: zodResolver(createClubSchema),
    defaultValues: { name: "" },
  });

  async function onSubmit(values: CreateClubFormValues) {
    try {
      await createClub.mutateAsync(values.name);
      toast.success("باشگاه با موفقیت ساخته شد.");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "ساخت باشگاه با خطا مواجه شد."
      );
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">نام باشگاه</Label>
        <Input
          id="name"
          placeholder="مثلاً باشگاه ورزشی آریا"
          {...form.register("name")}
        />
        {form.formState.errors.name && (
          <p className="text-xs text-destructive">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={createClub.isPending}
      >
        {createClub.isPending && <Loader2 className="animate-spin" />}
        ساخت باشگاه
      </Button>

      {skippable && (
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          فعلاً رد شو
        </button>
      )}
    </form>
  );
}
