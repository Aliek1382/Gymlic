import { DatabaseZap } from "lucide-react";

/** Shown until app-settings-update.sql has been run: nothing can be saved yet. */
export function SettingsStorageNotice() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-muted px-4 py-3 text-sm text-warning">
      <DatabaseZap className="mt-0.5 size-5 shrink-0" />
      <p className="leading-6">
        جدول تنظیمات هنوز در دیتابیس ساخته نشده است، پس تغییرات این صفحه ذخیره نمی‌شوند و سایت
        با تنظیمات پیش‌فرض کار می‌کند. دستور فایل{" "}
        <code dir="ltr">backend-php/schema/app-settings-update.sql</code> را در phpMyAdmin (تب SQL)
        اجرا کنید.
      </p>
    </div>
  );
}
