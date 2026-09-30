import type { LucideIcon } from "lucide-react";
import {
  Apple,
  BarChart3,
  Bell,
  Bookmark,
  Calendar,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  LayoutGrid,
  LineChart,
  MessageCircle,
  Pill,
  Receipt,
  Ruler,
  Salad,
  Settings,
  Ticket,
  User,
  UserCircle,
  UserPen,
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
    { label: "اعلان‌ها", href: "/notifications", icon: Bell },
    { label: "تنظیمات", href: "/settings", icon: Settings },
  ],
  trainer: [
    { label: "داشبورد", href: "/dashboard", icon: LayoutGrid },
    { label: "ورزشکاران", href: "/athletes", icon: Users },
    { label: "برنامه‌های تمرینی", href: "/workout-programs", icon: Dumbbell },
    { label: "برنامه‌های غذایی", href: "/nutrition-programs", icon: Apple },
    {
      label: "پیام‌ها",
      href: "/messages",
      icon: MessageCircle,
      description:
        "گفتگوی مستقیم با هر ورزشکار درباره برنامه‌هایی که برایش نوشته‌اید.",
    },
    {
      label: "تیکت‌ها",
      href: "/tickets",
      icon: Ticket,
      description: "درخواست‌های رسمی ورزشکاران را با شمارهٔ پیگیری ببینید و وضعیتشان را مدیریت کنید.",
    },
    {
      label: "قالب‌ها",
      href: "/templates",
      icon: Bookmark,
      description:
        "قالب‌های آماده برای برنامه تمرینی و غذایی بسازید تا هنگام نوشتن برنامه برای ورزشکاران سریع‌تر شروع کنید.",
    },
    { label: "کتابخانه حرکات", href: "/exercises", icon: LineChart },
    { label: "کتابخانه غذاها", href: "/foods", icon: Salad },
    { label: "کتابخانه مکمل‌ها", href: "/supplements", icon: Pill },
    {
      label: "پیشرفت ورزشکاران",
      href: "/progress",
      icon: Ruler,
      description:
        "نمودار روند وزن، BMI، درصد چربی بدن، دور کمر و دور سینه‌ی هر ورزشکار را ببینید.",
    },
    {
      label: "درآمد من",
      href: "/earnings",
      icon: Wallet,
      description:
        "شهریه‌های دریافتی از شاگردانتان را ثبت کنید و درآمد ماهانه و روند آن را ببینید.",
    },
    {
      label: "پرسشنامه‌ها",
      href: "/questionnaires",
      icon: ClipboardList,
      description:
        "فرم دلخواه بسازید، برای ورزشکاران بفرستید و پاسخ‌ها را جدولی و خلاصه ببینید.",
    },
    {
      label: "فاکتورهای من",
      href: "/invoices",
      icon: Receipt,
      description:
        "فاکتورهایی که برای برنامه‌های ورزشکاران صادر کرده‌اید و وضعیت پرداخت هرکدام.",
    },
    {
      label: "تقویم",
      href: "/calendar",
      icon: CalendarDays,
      description:
        "جلسات خصوصی زمان‌بندی‌شده و یادآوری‌های خودتان را در تقویم شمسی ماهانه ببینید.",
    },
    {
      label: "رزومهٔ من",
      href: "/trainer-resume",
      icon: UserPen,
      description:
        "بیوگرافی، افتخارات، مدارک، جدول تعرفه و شبکه‌های اجتماعی‌تان را برای شاگردانتان بنویسید.",
    },
    { label: "گزارش‌ها", href: "/reports", icon: BarChart3 },
    { label: "اعلان‌ها", href: "/notifications", icon: Bell },
    { label: "تنظیمات", href: "/settings", icon: Settings },
  ],
  athlete: [
    { label: "داشبورد", href: "/dashboard", icon: LayoutGrid },
    { label: "برنامه تمرینی", href: "/workout", icon: Dumbbell },
    { label: "برنامه غذایی", href: "/nutrition", icon: Apple },
    { label: "جلسات خصوصی", href: "/session-packages", icon: CalendarCheck },
    { label: "پرسشنامه‌ها", href: "/questionnaires", icon: ClipboardList },
    { label: "پیام‌ها", href: "/messages", icon: MessageCircle },
    { label: "تیکت‌ها", href: "/tickets", icon: Ticket },
    { label: "پیشرفت", href: "/progress", icon: BarChart3 },
    { label: "رزومهٔ مربی", href: "/trainer-resume", icon: UserPen },
    { label: "اعلان‌ها", href: "/notifications", icon: Bell },
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
