import type { LucideIcon } from "lucide-react";
import type { AdminRequirement } from "@/features/admin/hooks/use-admin-access";
import {
  Activity,
  Banknote,
  BookOpen,
  DatabaseZap,
  Dumbbell,
  History,
  Inbox,
  KeyRound,
  ShieldCheck,
  LayoutGrid,
  Megaphone,
  ReceiptText,
  Settings,
  Tags,
  ToggleRight,
  Trophy,
  UserCog,
  Users,
  UsersRound,
} from "lucide-react";

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** What an admin needs to see this page; omitted = any admin. */
  permission?: AdminRequirement;
}

export interface AdminNavGroup {
  /** No title for the first group: it holds only the overview. */
  title?: string;
  items: AdminNavItem[];
}

export const ADMIN_SIDEBAR_GROUPS: AdminNavGroup[] = [
  { items: [{ label: "نمای کلی", href: "/admin", icon: LayoutGrid }] },
  {
    title: "کاربران",
    items: [
      { label: "باشگاه‌ها", href: "/admin/clubs", icon: Users, permission: "users.view" },
      { label: "مربی‌ها", href: "/admin/trainers", icon: Dumbbell, permission: "users.view" },
      { label: "ورزشکاران", href: "/admin/athletes", icon: UsersRound, permission: "users.view" },
      { label: "همهٔ کاربران", href: "/admin/users", icon: UserCog, permission: "users.view" },
    ],
  },
  {
    title: "مالی",
    items: [
      { label: "درخواست‌های پرداخت", href: "/admin/payments", icon: ReceiptText, permission: "finance" },
      { label: "پلن‌ها", href: "/admin/plans", icon: Tags, permission: "finance" },
      { label: "گزارش مالی", href: "/admin/reports", icon: Banknote, permission: "finance" },
    ],
  },
  {
    title: "محتوا و ارتباط",
    items: [
      { label: "کتابخانه‌ها", href: "/admin/library", icon: BookOpen, permission: "content" },
      { label: "امتیاز مربیان", href: "/admin/points", icon: Trophy, permission: "content" },
      { label: "اعلان همگانی", href: "/admin/notifications", icon: Megaphone, permission: "notifications" },
    ],
  },
  {
    title: "تنظیمات",
    items: [
      { label: "مدیریت بخش‌ها", href: "/admin/features", icon: ToggleRight, permission: "settings" },
      { label: "تنظیمات سایت", href: "/admin/settings", icon: Settings, permission: "settings" },
    ],
  },
  {
    title: "امنیت",
    items: [
      { label: "امنیت ورود", href: "/admin/security", icon: ShieldCheck, permission: "super" },
      { label: "نقش‌های مدیریتی", href: "/admin/roles", icon: KeyRound, permission: "super" },
    ],
  },
  {
    title: "سیستم",
    items: [
      { label: "سلامت سایت", href: "/admin/system", icon: Activity, permission: "system" },
      { label: "به‌روزرسانی دیتابیس", href: "/admin/database", icon: DatabaseZap, permission: "super" },
      { label: "صف پیامک و ایمیل", href: "/admin/deliveries", icon: Inbox, permission: "system" },
      { label: "لاگ فعالیت", href: "/admin/activity", icon: History, permission: "activity" },
    ],
  },
];

/** Every page, flat — for the header's page title. */
export const ADMIN_SIDEBAR_NAV: AdminNavItem[] = ADMIN_SIDEBAR_GROUPS.flatMap((group) => group.items);

/** The menu entry a path belongs to (detail pages count as their list's). */
export function adminNavItemFor(pathname: string): AdminNavItem | undefined {
  return ADMIN_SIDEBAR_NAV.find((item) =>
    item.href === "/admin"
      ? pathname === "/admin"
      : pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
}
