"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/get-error-message";
import { useUpdateEmail } from "../hooks/use-update-email";
import {
  emailFormSchema,
  type EmailFormValues,
} from "../validators/settings-schemas";

export function EmailForm({ currentEmail }: { currentEmail: string | null }) {
  const updateEmail = useUpdateEmail();

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: { email: currentEmail ?? "" },
  });

  async function onSubmit(values: EmailFormValues) {
    try {
      await updateEmail.mutateAsync(values.email);
      toast.success(
        "درخواست تغییر ایمیل ثبت شد. اگر تایید ایمیل در پروژه فعال باشد، لینک تاییدیه برای شما ارسال می‌شود."
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "تغییر ایمیل با خطا مواجه شد."));
    }
  }

  return (
    <Card className="gap-6 py-6">
      <div className="px-6">
        <CardTitle className="text-base">ایمیل</CardTitle>
      </div>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="settings-email">آدرس ایمیل</Label>
            <Input
              id="settings-email"
              type="email"
              dir="ltr"
              className="text-left"
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <Button type="submit" disabled={updateEmail.isPending}>
            {updateEmail.isPending && <Loader2 className="animate-spin" />}
            به‌روزرسانی ایمیل
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
