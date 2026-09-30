"use client";

import { toast } from "sonner";

import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { Profile } from "@/features/authentication";
import { getErrorMessage } from "@/lib/get-error-message";
import { useUpdateNotificationChannels } from "../hooks/use-update-notification-channels";

/** Opt-in SMS / email copies of notifications; the in-app bell stays on either way. */
export function NotificationChannelsCard({ profile }: { profile: Profile }) {
  const update = useUpdateNotificationChannels();

  async function change(
    patch: { notifySms?: boolean; notifyEmail?: boolean },
    message: string
  ) {
    try {
      await update.mutateAsync(patch);
      toast.success(message);
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیره تنظیمات اعلان با خطا مواجه شد."));
    }
  }

  return (
    <Card className="gap-4 py-6">
      <div className="px-4 sm:px-6">
        <CardTitle className="text-base">اعلان‌ها</CardTitle>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          اعلان درون‌برنامه‌ای همیشه فعال است. اگر بخواهید، اعلان‌ها را به پیامک یا
          ایمیل هم دریافت کنید.
        </p>
      </div>
      <CardContent className="space-y-3 px-4 sm:px-6">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              دریافت پیامک برای اعلان‌های مهم
            </p>
            <p className="text-xs text-muted-foreground">
              {profile.phone
                ? "به شماره‌ی موبایل ثبت‌شده در حساب ارسال می‌شود."
                : "برای دریافت پیامک، ابتدا شماره‌ی موبایل خود را در بالا ثبت کنید."}
            </p>
          </div>
          <Switch
            checked={profile.notifySms}
            disabled={update.isPending}
            onCheckedChange={(checked) =>
              change(
                { notifySms: checked },
                checked ? "پیامک اعلان‌ها فعال شد." : "پیامک اعلان‌ها خاموش شد."
              )
            }
          />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              دریافت ایمیل برای اعلان‌های مهم
            </p>
            <p className="text-xs text-muted-foreground">
              {profile.email
                ? "به ایمیل ثبت‌شده در حساب ارسال می‌شود."
                : "برای دریافت ایمیل، ابتدا ایمیل خود را ثبت کنید."}
            </p>
          </div>
          <Switch
            checked={profile.notifyEmail}
            disabled={update.isPending}
            onCheckedChange={(checked) =>
              change(
                { notifyEmail: checked },
                checked ? "ایمیل اعلان‌ها فعال شد." : "ایمیل اعلان‌ها خاموش شد."
              )
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
