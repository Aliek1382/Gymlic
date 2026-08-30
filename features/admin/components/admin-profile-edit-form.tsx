"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/get-error-message";
import { BirthDatePicker } from "@/features/settings/components/birth-date-picker";
import { updateProfileAsAdmin } from "../services/admin-service";
import {
  adminProfileEditSchema,
  type AdminProfileEditFormValues,
} from "../validators/admin-schemas";

interface AdminProfileEditFormProps {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  showBirthDate?: boolean;
}

export function AdminProfileEditForm({
  userId,
  firstName,
  lastName,
  email,
  phone,
  birthDate,
  showBirthDate = true,
}: AdminProfileEditFormProps) {
  const router = useRouter();

  const form = useForm<AdminProfileEditFormValues>({
    resolver: zodResolver(adminProfileEditSchema),
    defaultValues: {
      firstName: firstName ?? "",
      lastName: lastName ?? "",
      email: email ?? "",
      phone: phone ?? "",
      birthDate,
    },
  });

  async function onSubmit(values: AdminProfileEditFormValues) {
    try {
      await updateProfileAsAdmin({
        userId,
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email || null,
        phone: values.phone || null,
        birthDate: showBirthDate ? values.birthDate ?? null : birthDate,
      });
      toast.success("اطلاعات پروفایل به‌روزرسانی شد.");
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, "به‌روزرسانی اطلاعات با خطا مواجه شد."));
    }
  }

  return (
    <Card className="gap-6 py-6">
      <div className="px-6">
        <CardTitle className="text-base">ویرایش اطلاعات پروفایل</CardTitle>
      </div>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="admin-first-name">نام</Label>
              <Input id="admin-first-name" {...form.register("firstName")} />
              {form.formState.errors.firstName && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.firstName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-last-name">نام خانوادگی</Label>
              <Input id="admin-last-name" {...form.register("lastName")} />
              {form.formState.errors.lastName && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="admin-email">ایمیل</Label>
              <Input id="admin-email" dir="ltr" {...form.register("email")} />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-phone">شماره تماس</Label>
              <Input
                id="admin-phone"
                dir="ltr"
                inputMode="numeric"
                placeholder="09xxxxxxxxx"
                className="text-center"
                {...form.register("phone")}
              />
              {form.formState.errors.phone && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.phone.message}
                </p>
              )}
            </div>
          </div>

          {showBirthDate && (
            <div className="space-y-2">
              <Label>تاریخ تولد</Label>
              <Controller
                control={form.control}
                name="birthDate"
                render={({ field }) => (
                  <BirthDatePicker
                    value={field.value ?? null}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          )}

          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
            ذخیره تغییرات
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
