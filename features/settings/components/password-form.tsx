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
import { useUpdatePassword } from "../hooks/use-update-password";
import {
  passwordFormSchema,
  type PasswordFormValues,
} from "../validators/settings-schemas";

export function PasswordForm() {
  const updatePassword = useUpdatePassword();

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: PasswordFormValues) {
    try {
      await updatePassword.mutateAsync(values.newPassword);
      toast.success("رمز عبور با موفقیت تغییر کرد.");
      form.reset({ newPassword: "", confirmPassword: "" });
    } catch (error) {
      toast.error(getErrorMessage(error, "تغییر رمز عبور با خطا مواجه شد."));
    }
  }

  return (
    <Card className="gap-6 py-6">
      <div className="px-6">
        <CardTitle className="text-base">تغییر رمز عبور</CardTitle>
      </div>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="settings-new-password">رمز عبور جدید</Label>
              <Input
                id="settings-new-password"
                type="password"
                dir="ltr"
                {...form.register("newPassword")}
              />
              {form.formState.errors.newPassword && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.newPassword.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-confirm-password">
                تکرار رمز عبور جدید
              </Label>
              <Input
                id="settings-confirm-password"
                type="password"
                dir="ltr"
                {...form.register("confirmPassword")}
              />
              {form.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
          </div>

          <Button type="submit" disabled={updatePassword.isPending}>
            {updatePassword.isPending && <Loader2 className="animate-spin" />}
            تغییر رمز عبور
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
