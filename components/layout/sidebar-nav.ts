import type { LucideIcon } from "lucide-react";
import {
  Apple,
  BarChart3,
  Bookmark,
  Calendar,
  Dumbbell,
  LayoutGrid,
  LineChart,
  Settings,
  User,
  UserCircle,
  Users,
  Wallet,
} from "lucide-react";

import type { AccountType } from "@/types/database.types";

export interface SidebarNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
}

// Dashboard Pack — اصلاح شماره ۴: Sidebar is Dynamic per role.
export const SIDEBAR_NAV: Record<AccountType, SidebarNavItem[]> = {
  club: [
    { label: "داشبورد", href: "/dashboard", icon: LayoutGrid },
    { label: "اعضا", href: "/members", icon: Users },
    { label: "مربیان", href: "/trainers", icon: Dumbbell },
    { label: "کلاس‌ها", href: "/classes", icon: Calendar },
    { label: "امور مالی", href: "/finance", icon: Wallet },
    { label: "تنظیمات", href: "/settings", icon: Settings },
  ],
  trainer: [
    { label: "داشبورد", href: "/dashboard", icon: LayoutGrid },
    { label: "ورزشکاران", href: "/athletes", icon: Users },
    { label: "برنامه‌های تمرینی", href: "/workout-programs", icon: Dumbbell },
    { label: "برنامه‌های غذایی", href: "/nutrition-programs", icon: Apple },
    {
      label: "قالب‌ها",
      href: "/templates",
      icon: Bookmark,
      description:
        "قالب‌های آماده برای برنامه تمرینی و غذایی بسازید تا هنگام نوشتن برنامه برای ورزشکاران سریع‌تر شروع کنید.",
    },
    { label: "کتابخانه حرکات", href: "/exercises", icon: LineChart },
    { label: "گزارش‌ها", href: "/reports", icon: BarChart3 },
    { label: "تنظیمات", href: "/settings", icon: Settings },
  ],
  athlete: [
    { label: "داشبورد", href: "/dashboard", icon: LayoutGrid },
    { label: "برنامه تمرینی", href: "/workout", icon: Dumbbell },
    { label: "برنامه غذایی", href: "/nutrition", icon: Apple },
    { label: "پیشرفت", href: "/progress", icon: BarChart3 },
    { label: "پروفایل", href: "/profile", icon: UserCircle },
  ],
};

export const ROLE_LABEL: Record<AccountType, string> = {
  club: "مدیر باشگاه",
  trainer: "مربی",
  athlete: "ورزشکار",
};

export const ROLE_ICON: Record<AccountType, LucideIcon> = {
  club: Users,
  trainer: Dumbbell,
  athlete: User,
};
