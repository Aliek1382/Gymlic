"use client";

import { History } from "lucide-react";

import { Card, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber, formatRelativeTime } from "@/lib/persian";
import { useQuery } from "@tanstack/react-query";

import { listAdminActivity } from "../services/admin-service";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";

const ADMIN_ACTIONS = [
  "subscription_activated",
  "payment_request_rejected",
  "club_status_changed",
  "profile_suspended_changed",
  "profile_edited_by_admin",
  // What the backend actually writes for these two; the names above never
  // matched, so suspensions and profile edits were missing from this page.
  "profile_suspension_changed",
  "profile_updated",
  "settings_updated",
  "library_item_created",
  "library_item_updated",
  "library_item_deleted",
  "library_item_published",
  "point_rule_updated",
  "points_adjusted",
  "user_role_changed",
  "admin_granted",
  "admin_revoked",
  "password_set_by_admin",
  "migration_run",
  "backup_downloaded",
  "delivery_retried",
  "sessions_revoked",
  "two_factor_enabled",
  "login_unlocked",
  "admin_role_saved",
  "admin_role_deleted",
];

const ACTION_LABEL: Record<string, string> = {
  subscription_activated: "فعال‌سازی اشتراک باشگاه",
  payment_request_rejected: "رد درخواست پرداخت",
  club_status_changed: "تغییر وضعیت باشگاه",
  profile_suspended_changed: "تغییر وضعیت مسدودی حساب",
  profile_edited_by_admin: "ویرایش پروفایل توسط مدیر",
  profile_suspension_changed: "تغییر وضعیت مسدودی حساب",
  profile_updated: "ویرایش پروفایل توسط مدیر",
  settings_updated: "تغییر تنظیمات سایت",
  library_item_created: "افزودن به کتابخانه",
  library_item_updated: "ویرایش مورد کتابخانه",
  library_item_deleted: "حذف از کتابخانه",
  library_item_published: "انتقال به بانک عمومی",
  point_rule_updated: "تغییر قانون امتیاز",
  points_adjusted: "امتیاز دستی به مربی",
  user_role_changed: "تغییر نقش کاربر",
  admin_granted: "دادن دسترسی مدیریت",
  admin_revoked: "برداشتن دسترسی مدیریت",
  password_set_by_admin: "تعیین رمز جدید توسط مدیر",
  migration_run: "اجرای به‌روزرسانی دیتابیس",
  backup_downloaded: "دانلود نسخهٔ پشتیبان",
  delivery_retried: "ارسال دوبارهٔ پیامک/ایمیل",
  sessions_revoked: "خارج‌کردن کاربر از دستگاه‌ها",
  two_factor_enabled: "روشن‌کردن ورود دومرحله‌ای",
  login_unlocked: "باز کردن قفل ورود",
  admin_role_saved: "ذخیرهٔ نقش مدیریتی",
  admin_role_deleted: "حذف نقش مدیریتی",
};

const SETTINGS_GROUP_LABEL: Record<string, string> = {
  maintenance: "حالت تعمیر",
  signup: "ثبت‌نام",
  announcement: "اطلاعیهٔ پنل",
  support: "پشتیبانی",
  features: "مدیریت بخش‌ها",
  points_levels: "سطح‌های امتیاز",
  limits: "محدودیت پیام و فایل",
  sms: "تنظیمات پیامک",
  mail: "تنظیمات ایمیل",
  security: "امنیت ورود",
};

export function AdminActivityPage() {
  const { data } = useQuery({
    queryKey: ["admin", "activity"],
    queryFn: async () => ({
      rows: (await listAdminActivity()).filter((log) =>
        ADMIN_ACTIONS.includes(log.action)
      ),
    }),
  });

  const rows = data?.rows ?? [];

  return (

    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">لاگ فعالیت مدیر</h1>
        <p className="text-sm text-muted-foreground">
          ردیابی تمام اقداماتی که در پنل مدیریت انجام شده است.
        </p>
      </div>

      <Card className="gap-4 py-5">
        <div className="px-6">
          <CardTitle className="text-base">
            {formatNumber(rows.length)} رویداد اخیر
          </CardTitle>
        </div>

        {rows.length === 0 ? (
          <div className="px-6">
            <EmptyState
              icon={History}
              title="هنوز اقدامی ثبت نشده است."
              description="اقدامات شما در پنل مدیریت (تایید پرداخت، مسدودسازی و...) اینجا ثبت می‌شود."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>اقدام</TableHead>
                <TableHead>باشگاه</TableHead>
                <TableHead>مربوط به</TableHead>
                <TableHead>زمان</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((log) => {
                const settingsGroup =
                  log.action === "settings_updated" ? String(log.metadata?.key ?? "") : "";
                // Library actions have no person as subject: show the entry's name.
                const libraryItem = log.action.startsWith("library_item_")
                  ? String(log.metadata?.name ?? "")
                  : "";
                const migration =
                  log.action === "migration_run"
                    ? `${String(log.metadata?.id ?? "")}${log.metadata?.ok === false ? " (ناموفق)" : ""}`
                    : "";
                const roleOrLock =
                  log.action.startsWith("admin_role_")
                    ? String(log.metadata?.name ?? "")
                    : log.action === "login_unlocked"
                      ? String(log.metadata?.email ?? log.metadata?.ip ?? "")
                      : "";
                const subjectName =
                  (roleOrLock || undefined) ??
                  SETTINGS_GROUP_LABEL[settingsGroup] ??
                  (migration ||
                  (libraryItem ||
                  [log.subject_first_name, log.subject_last_name].filter(Boolean).join(" ")));
                return (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium text-foreground">
                      {ACTION_LABEL[log.action] ?? log.action}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.club_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {subjectName || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelativeTime(new Date(log.created_at))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
