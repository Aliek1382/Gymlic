import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Banknote,
  BookOpen,
  DatabaseZap,
  Dumbbell,
  History,
  Inbox,
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
      { label: "باشگاه‌ها", href: "/admin/clubs", icon: Users },
      { label: "مربی‌ها", href: "/admin/trainers", icon: Dumbbell },
      { label: "ورزشکاران", href: "/admin/athletes", icon: UsersRound },
      { label: "همهٔ کاربران", href: "/admin/users", icon: UserCog },
    ],
  },
  {
    title: "مالی",
    items: [
      { label: "درخواست‌های پرداخت", href: "/admin/payments", icon: ReceiptText },
      { label: "پلن‌ها", href: "/admin/plans", icon: Tags },
      { label: "گزارش مالی", href: "/admin/reports", icon: Banknote },
    ],
  },
  {
    title: "محتوا و ارتباط",
    items: [
      { label: "کتابخانه‌ها", href: "/admin/library", icon: BookOpen },
      { label: "امتیاز مربیان", href: "/admin/points", icon: Trophy },
      { label: "اعلان همگانی", href: "/admin/notifications", icon: Megaphone },
    ],
  },
  {
    title: "تنظیمات",
    items: [
      { label: "مدیریت بخش‌ها", href: "/admin/features", icon: ToggleRight },
      { label: "تنظیمات سایت", href: "/admin/settings", icon: Settings },
    ],
  },
  {
    title: "سیستم",
    items: [
      { label: "سلامت سایت", href: "/admin/system", icon: Activity },
      { label: "به‌روزرسانی دیتابیس", href: "/admin/database", icon: DatabaseZap },
      { label: "صف پیامک و ایمیل", href: "/admin/deliveries", icon: Inbox },
      { label: "لاگ فعالیت", href: "/admin/activity", icon: History },
    ],
  },
];

/** Every page, flat — for the header's page title. */
export const ADMIN_SIDEBAR_NAV: AdminNavItem[] = ADMIN_SIDEBAR_GROUPS.flatMap((group) => group.items);
