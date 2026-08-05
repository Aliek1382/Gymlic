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
import type { Profile } from "@/features/authentication";
import { useUpdateProfileInfo } from "../hooks/use-update-profile-info";
import {
  profileInfoSchema,
  type ProfileInfoFormValues,
} from "../validators/settings-schemas";
import { AvatarUpload } from "./avatar-upload";

export function ProfileInfoForm({ profile }: { profile: Profile }) {
  const updateProfileInfo = useUpdateProfileInfo();

  const form = useForm<ProfileInfoFormValues>({
    resolver: zodResolver(profileInfoSchema),
    defaultValues: {
      firstName: profile.firstName ?? "",
      lastName: profile.lastName ?? "",
      phone: profile.phone ?? "",
    },
  });

  async function onSubmit(values: ProfileInfoFormValues) {
    try {
      await updateProfileInfo.mutateAsync({
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone || null,
      });
      toast.success("اطلاعات پروفایل به‌روزرسانی شد.");
    } catch (error) {
      toast.error(getErrorMessage(error, "به‌روزرسانی اطلاعات با خطا مواجه شد."));
    }
  }

  const fallback =
    [profile.firstName, profile.lastName]
      .filter(Boolean)
      .join(" ")
      .slice(0, 2) || "کا";

  return (
    <Card className="gap-6 py-6">
      <div className="px-6">
        <CardTitle className="text-base">اطلاعات شخصی</CardTitle>
      </div>
      <CardContent className="space-y-6">
        <AvatarUpload avatarUrl={profile.avatarUrl} fallback={fallback} />

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="settings-first-name">نام</Label>
              <Input id="settings-first-name" {...form.register("firstName")} />
              {form.formState.errors.firstName && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.firstName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-last-name">نام خانوادگی</Label>
              <Input id="settings-last-name" {...form.register("lastName")} />
              {form.formState.errors.lastName && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-phone">شماره تماس (اختیاری)</Label>
            <Input
              id="settings-phone"
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

          <Button type="submit" disabled={updateProfileInfo.isPending}>
            {updateProfileInfo.isPending && <Loader2 className="animate-spin" />}
            ذخیره تغییرات
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
