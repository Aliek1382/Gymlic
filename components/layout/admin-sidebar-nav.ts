import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BookOpen,
  Dumbbell,
  History,
  LayoutGrid,
  Megaphone,
  ReceiptText,
  Settings,
  Tags,
  ToggleRight,
  Trophy,
  Users,
  UsersRound,
} from "lucide-react";

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const ADMIN_SIDEBAR_NAV: AdminNavItem[] = [
  { label: "نمای کلی", href: "/admin", icon: LayoutGrid },
  { label: "باشگاه‌ها", href: "/admin/clubs", icon: Users },
  { label: "مربی‌ها", href: "/admin/trainers", icon: Dumbbell },
  { label: "ورزشکاران", href: "/admin/athletes", icon: UsersRound },
  { label: "درخواست‌های پرداخت", href: "/admin/payments", icon: ReceiptText },
  { label: "پلن‌ها", href: "/admin/plans", icon: Tags },
  { label: "گزارش مالی", href: "/admin/reports", icon: Banknote },
  { label: "اعلان همگانی", href: "/admin/notifications", icon: Megaphone },
  { label: "لاگ فعالیت", href: "/admin/activity", icon: History },
  { label: "کتابخانه‌ها", href: "/admin/library", icon: BookOpen },
  { label: "امتیاز مربیان", href: "/admin/points", icon: Trophy },
  { label: "مدیریت بخش‌ها", href: "/admin/features", icon: ToggleRight },
  { label: "تنظیمات سایت", href: "/admin/settings", icon: Settings },
];
