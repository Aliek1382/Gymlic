"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoleGate } from "@/features/authentication/components/role-gate";
import { useAuthContext } from "@/features/authentication/hooks/use-auth-context";
import { ClubProfileForm, MembershipPlansManager } from "@/features/club";
import { SettingsView } from "./settings-view";

export function SettingsPage() {
  const { data: context } = useAuthContext();
  const clubId =
    context?.accountType === "club" ? context.activeMembership?.clubId : undefined;

  return (
    <RoleGate>
      {!clubId ? (
        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">تنظیمات حساب</h1>
            <p className="text-sm text-muted-foreground">
              اطلاعات شخصی، تصویر پروفایل، ایمیل و رمز عبور خود را مدیریت کنید.
            </p>
          </div>

          <SettingsView />
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">تنظیمات</h1>
            <p className="text-sm text-muted-foreground">
              اطلاعات باشگاه، طرح‌های عضویت و حساب کاربری خود را مدیریت کنید.
            </p>
          </div>

          <Tabs defaultValue="club" className="space-y-6">
            <TabsList>
              <TabsTrigger value="club">اطلاعات باشگاه</TabsTrigger>
              <TabsTrigger value="plans">طرح‌های عضویت</TabsTrigger>
              <TabsTrigger value="account">حساب کاربری</TabsTrigger>
            </TabsList>

            <TabsContent value="club">
              <ClubProfileForm clubId={clubId} />
            </TabsContent>

            <TabsContent value="plans">
              <MembershipPlansManager clubId={clubId} />
            </TabsContent>

            <TabsContent value="account">
              <SettingsView />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </RoleGate>
  );
}
