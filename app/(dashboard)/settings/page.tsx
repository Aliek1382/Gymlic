import { Settings } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "تنظیمات | جیم‌لیک" };

export default function SettingsPage() {
  return (
    <ComingSoon
      icon={Settings}
      title="تنظیمات حساب"
      description="مدیریت اطلاعات حساب، اعلان‌ها و تنظیمات باشگاه به‌زودی در دسترس خواهد بود."
    />
  );
}
