"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/features/authentication";
import { TrainerPaymentInfoCard } from "@/features/invoices/components/trainer-payment-info-card";
import { EmailForm } from "./email-form";
import { NutritionGoalCard } from "./nutrition-goal-card";
import { NotificationChannelsCard } from "./notification-channels-card";
import { PasswordForm } from "./password-form";
import { ProfileInfoForm } from "./profile-info-form";
import { SignOutSection } from "./sign-out-section";
import { TrainerDataExportCard } from "./trainer-data-export";

export function SettingsView() {
  const profile = useProfile();

  if (profile.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <Card className="border-destructive/30 py-5">
        <p className="px-6 text-sm text-destructive">
          دریافت اطلاعات حساب با خطا مواجه شد. صفحه را دوباره بارگذاری کنید.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ProfileInfoForm profile={profile.data} />
      {profile.data.accountType === "athlete" && (
        <NutritionGoalCard profile={profile.data} />
      )}
      {profile.data.accountType === "trainer" && <TrainerPaymentInfoCard />}
      <NotificationChannelsCard profile={profile.data} />
      <EmailForm currentEmail={profile.data.email} />
      <PasswordForm />
      {profile.data.accountType === "trainer" && <TrainerDataExportCard />}
      <SignOutSection />
    </div>
  );
}
