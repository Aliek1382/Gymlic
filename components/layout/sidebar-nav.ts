import type { LucideIcon } from "lucide-react";
import {
  Apple,
  BarChart3,
  Bell,
  Bookmark,
  BookOpen,
  Calendar,
  CalendarCheck,
  CalendarDays,
  CircleHelp,
  ClipboardList,
  Dumbbell,
  Headset,
  LayoutGrid,
  Library,
  LineChart,
  MessageCircle,
  MessagesSquare,
  Receipt,
  Ruler,
  Salad,
  Settings,
  Ticket,
  Trophy,
  User,
  UserCircle,
  UserCog,
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

/** A collapsible menu entry that holds several pages, so the sidebar stays short. */
export interface SidebarNavGroup {
  label: string;
  icon: LucideIcon;
  children: SidebarNavItem[];
}

export type SidebarNavEntry = SidebarNavItem | SidebarNavGroup;

export function isNavGroup(entry: SidebarNavEntry): entry is SidebarNavGroup {
  return "children" in entry;
}

/** Every page in the menu, groups unfolded — for the page title and quick search. */
export function flattenNav(entries: SidebarNavEntry[]): SidebarNavItem[] {
  return entries.flatMap((entry) => (isNavGroup(entry) ? entry.children : [entry]));
}

// Dashboard Pack — اصلاح شماره ۴: Sidebar is Dynamic per role.
export const SIDEBAR_NAV: Record<AccountType, SidebarNavEntry[]> = {
  club: [
    { label: "داشبورد", href: "/dashboard", icon: LayoutGrid },
    { label: "اعضا", href: "/members", icon: Users },
    { label: "مربیان", href: "/trainers", icon: Dumbbell },
    { label: "کلاس‌ها", href: "/classes", icon: Calendar },
    { label: "امور مالی", href: "/finance", icon: Wallet },
    { label: "اعلان‌ها", href: "/notifications", icon: Bell },
    { label: "پشتیبانی", href: "/support", icon: Headset },
    { label: "تنظیمات", href: "/settings", icon: Settings },
  ],
  trainer: [
    { label: "داشبورد", href: "/dashboard", icon: LayoutGrid },
    { label: "ورزشکاران", href: "/athletes", icon: Users },
    {
      label: "برنامه‌ها",
      icon: ClipboardList,
      children: [
        { label: "برنامه‌های تمرینی", href: "/workout-programs", icon: Dumbbell },
        { label: "برنامه‌های غذایی", href: "/nutrition-programs", icon: Apple },
        {
          label: "قالب‌ها",
          href: "/templates",
          icon: Bookmark,
          description:
            "قالب‌های آماده برای برنامه تمرینی و غذایی بسازید تا هنگام نوشتن برنامه برای ورزشکاران سریع‌تر شروع کنید.",
        },
        {
          label: "محتوای آماده",
          href: "/content-library",
          icon: Library,
          description:
            "قالب برنامه، تکنیک و پرسشنامه‌های آمادهٔ تیم جیم‌لیک را ببینید و به مال خودتان اضافه کنید.",
        },
      ],
    },
    {
      label: "کتابخانه‌ها",
      icon: BookOpen,
      children: [
        { label: "کتابخانه حرکات", href: "/exercises", icon: LineChart },
        {
          label: "کتابخانه غذاها",
          href: "/foods",
          icon: Salad,
          description: "غذاها و مکمل‌ها در یک کتابخانه، در دو زبانه.",
        },
      ],
    },
    {
      label: "ارتباطات",
      icon: MessagesSquare,
      children: [
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
          description:
            "درخواست‌های رسمی ورزشکاران را با شمارهٔ پیگیری ببینید و وضعیتشان را مدیریت کنید.",
        },
      ],
    },
    {
      label: "پیشرفت ورزشکاران",
      href: "/progress",
      icon: Ruler,
      description:
        "نمودار روند وزن، BMI، درصد چربی بدن، دور کمر و دور سینه‌ی هر ورزشکار را ببینید.",
    },
    {
      label: "پرسشنامه‌ها",
      href: "/questionnaires",
      icon: ClipboardList,
      description:
        "فرم دلخواه بسازید، برای ورزشکاران بفرستید و پاسخ‌ها را جدولی و خلاصه ببینید.",
    },
    {
      label: "تقویم",
      href: "/calendar",
      icon: CalendarDays,
      description:
        "جلسات خصوصی زمان‌بندی‌شده و یادآوری‌های خودتان را در تقویم شمسی ماهانه ببینید.",
    },
    {
      label: "مالی",
      icon: Wallet,
      children: [
        {
          label: "درآمد من",
          href: "/earnings",
          icon: Wallet,
          description:
            "شهریه‌های دریافتی از شاگردانتان را ثبت کنید و درآمد ماهانه و روند آن را ببینید.",
        },
        {
          label: "فاکتورهای من",
          href: "/invoices",
          icon: Receipt,
          description:
            "فاکتورهایی که برای برنامه‌های ورزشکاران صادر کرده‌اید و وضعیت پرداخت هرکدام.",
        },
      ],
    },
    { label: "گزارش‌ها", href: "/reports", icon: BarChart3 },
    { label: "اعلان‌ها", href: "/notifications", icon: Bell },
    { label: "راهنمای استفاده", href: "/help", icon: CircleHelp },
    {
      label: "پشتیبانی",
      href: "/support",
      icon: Headset,
      description: "سؤال، مشکل یا پیشنهادتان را برای تیم جیم‌لیک بفرستید.",
    },
    {
      label: "حساب من",
      icon: UserCog,
      children: [
        { label: "تنظیمات و پروفایل", href: "/settings", icon: Settings },
        {
          label: "رزومهٔ من",
          href: "/trainer-resume",
          icon: UserPen,
          description:
            "بیوگرافی، افتخارات، مدارک، جدول تعرفه و شبکه‌های اجتماعی‌تان را برای شاگردانتان بنویسید.",
        },
        {
          label: "امتیاز من",
          href: "/points",
          icon: Trophy,
          description: "امتیاز و سطح خود را ببینید و بدانید هر امتیاز را برای چه کاری گرفته‌اید.",
        },
      ],
    },
  ],
  athlete: [
    { label: "داشبورد", href: "/dashboard", icon: LayoutGrid },
    { label: "برنامه تمرینی", href: "/workout", icon: Dumbbell },
    { label: "برنامه غذایی", href: "/nutrition", icon: Apple },
    { label: "جلسات خصوصی", href: "/session-packages", icon: CalendarCheck },
    { label: "پرسشنامه‌ها", href: "/questionnaires", icon: ClipboardList },
    {
      label: "ارتباطات",
      icon: MessagesSquare,
      children: [
        { label: "پیام‌ها", href: "/messages", icon: MessageCircle },
        { label: "تیکت‌ها", href: "/tickets", icon: Ticket },
      ],
    },
    { label: "پیشرفت", href: "/progress", icon: BarChart3 },
    { label: "اعلان‌ها", href: "/notifications", icon: Bell },
    {
      label: "حساب من",
      icon: UserCog,
      children: [
        { label: "پروفایل", href: "/profile", icon: UserCircle },
        { label: "رزومهٔ مربی", href: "/trainer-resume", icon: UserPen },
      ],
    },
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
