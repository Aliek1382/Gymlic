"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/get-error-message";
import { toAsciiDigits, toPersianDigits } from "@/lib/persian";
import { useClubProfile } from "../hooks/use-club-profile";
import { useUpdateClubProfile } from "../hooks/use-update-club-profile";
import {
  clubProfileSchema,
  type ClubProfileFormValues,
} from "../validators/club-schemas";
import { ClubLogoUpload } from "./club-logo-upload";

export function ClubProfileForm({ clubId }: { clubId: string }) {
  const club = useClubProfile(clubId);
  const updateClub = useUpdateClubProfile(clubId);

  const form = useForm<ClubProfileFormValues>({
    resolver: zodResolver(clubProfileSchema),
    defaultValues: { name: "", address: "", phone: "", workingHours: "" },
  });

  const { reset } = form;
  useEffect(() => {
    if (!club.data) return;
    reset({
      name: club.data.name,
      address: club.data.address ?? "",
      phone: club.data.phone ?? "",
      workingHours: club.data.workingHours ?? "",
    });
  }, [club.data, reset]);

  async function onSubmit(values: ClubProfileFormValues) {
    try {
      await updateClub.mutateAsync({
        name: values.name,
        address: values.address?.trim() || null,
        phone: values.phone ? toAsciiDigits(values.phone.trim()) : null,
        workingHours: values.workingHours?.trim() || null,
      });
      toast.success("اطلاعات باشگاه ذخیره شد.");
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیره اطلاعات باشگاه با خطا مواجه شد."));
    }
  }

  if (club.isLoading) {
    return <Skeleton className="h-96 w-full rounded-2xl" />;
  }

  if (club.isError || !club.data) {
    return (
      <Card className="border-destructive/30 py-5">
        <p className="px-6 text-sm text-destructive">
          دریافت اطلاعات باشگاه با خطا مواجه شد. صفحه را دوباره بارگذاری کنید.
        </p>
      </Card>
    );
  }

  return (
    <Card className="gap-5 py-5">
      <div className="px-6">
        <CardTitle className="text-base">اطلاعات باشگاه</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          این اطلاعات هویت باشگاه شما در جیم‌لیک است.
          {club.data.memberCapacity != null && (
            <>
              {" "}
              سقف اعضای پلن فعلی شما{" "}
              {toPersianDigits(club.data.memberCapacity)} نفر است.
            </>
          )}
        </p>
      </div>

      <div className="px-6">
        <ClubLogoUpload
          clubId={clubId}
          logoUrl={club.data.logoUrl}
          clubName={club.data.name}
        />
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-6">
        <div className="space-y-2">
          <Label htmlFor="club-name">نام باشگاه</Label>
          <Input id="club-name" {...form.register("name")} />
          {form.formState.errors.name && (
            <p className="text-xs text-destructive">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="club-phone">شماره تماس باشگاه</Label>
          <Input
            id="club-phone"
            dir="ltr"
            inputMode="numeric"
            placeholder="۰۲۱۱۲۳۴۵۶۷۸"
            className="text-center"
            {...form.register("phone")}
          />
          {form.formState.errors.phone && (
            <p className="text-xs text-destructive">
              {form.formState.errors.phone.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="club-address">آدرس</Label>
          <Input
            id="club-address"
            placeholder="مثلاً تهران، خیابان ولیعصر، پلاک ۱۲"
            {...form.register("address")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="club-working-hours">ساعات کاری</Label>
          <Input
            id="club-working-hours"
            placeholder="مثلاً شنبه تا پنج‌شنبه، ۸ صبح تا ۱۰ شب"
            {...form.register("workingHours")}
          />
        </div>

        <Button type="submit" disabled={updateClub.isPending}>
          {updateClub.isPending && <Loader2 className="animate-spin" />}
          ذخیره اطلاعات باشگاه
        </Button>
      </form>
    </Card>
  );
}
