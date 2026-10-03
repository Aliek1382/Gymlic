import type { LucideIcon } from "lucide-react";
import type { AdminRequirement } from "@/features/admin/hooks/use-admin-access";
import {
  Activity,
  BadgeCheck,
  Bug,
  HardDrive,
  Layers,
  Trash2,
  Banknote,
  BookOpen,
  CalendarClock,
  DatabaseZap,
  Dumbbell,
  FileText,
  Headset,
  History,
  Inbox,
  KeyRound,
  Landmark,
  ShieldCheck,
  LayoutGrid,
  Library,
  Megaphone,
  MessageSquareText,
  Palette,
  ReceiptText,
  Settings,
  Tags,
  Ticket,
  TicketPercent,
  ToggleRight,
  TrendingUp,
  Trophy,
  UserCheck,
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
  /** No title for the first group: the overview and the stats. */
  title?: string;
  items: AdminNavItem[];
}

export const ADMIN_SIDEBAR_GROUPS: AdminNavGroup[] = [
  {
    items: [
      { label: "نمای کلی", href: "/admin", icon: LayoutGrid },
      { label: "آمار رشد و استفاده", href: "/admin/stats", icon: TrendingUp, permission: "users.view" },
    ],
  },
  {
    title: "کاربران",
    items: [
      { label: "باشگاه‌ها", href: "/admin/clubs", icon: Users, permission: "users.view" },
      { label: "مربی‌ها", href: "/admin/trainers", icon: Dumbbell, permission: "users.view" },
      { label: "ورزشکاران", href: "/admin/athletes", icon: UsersRound, permission: "users.view" },
      { label: "همهٔ کاربران", href: "/admin/users", icon: UserCog, permission: "users.view" },
      { label: "تأیید مدارک مربی", href: "/admin/verifications", icon: BadgeCheck, permission: "users.verify" },
    ],
  },
  {
    title: "مالی",
    items: [
      { label: "درخواست‌های پرداخت", href: "/admin/payments", icon: ReceiptText, permission: "finance.payments" },
      { label: "اشتراک‌ها و پلن‌ها", href: "/admin/subscriptions", icon: CalendarClock, permission: "finance.plans" },
      { label: "پلن‌ها", href: "/admin/plans", icon: Tags, permission: "finance.plans" },
      { label: "اشتراک مربیان", href: "/admin/trainer-billing", icon: UserCheck, permission: "finance.plans" },
      { label: "سطح پلن‌ها", href: "/admin/tiers", icon: Layers, permission: "finance.plans" },
      { label: "کدهای تخفیف", href: "/admin/discounts", icon: TicketPercent, permission: "finance.plans" },
      { label: "اطلاعات پرداخت", href: "/admin/billing", icon: Landmark, permission: "finance.plans" },
      { label: "گزارش مالی", href: "/admin/reports", icon: Banknote, permission: "finance.reports" },
    ],
  },
  {
    title: "محتوا و ارتباط",
    items: [
      { label: "کتابخانه‌ها", href: "/admin/library", icon: BookOpen, permission: "content" },
      { label: "محتوای آماده", href: "/admin/content", icon: Library, permission: "content" },
      { label: "امتیاز مربیان", href: "/admin/points", icon: Trophy, permission: "content" },
      { label: "صفحه‌های متنی", href: "/admin/pages", icon: FileText, permission: "content" },
      { label: "اعلان همگانی", href: "/admin/notifications", icon: Megaphone, permission: "notifications" },
      { label: "قالب متن اعلان‌ها", href: "/admin/templates", icon: MessageSquareText, permission: "notifications" },
      { label: "تیکت‌های پشتیبانی", href: "/admin/support", icon: Headset, permission: "support" },
      { label: "تیکت‌های مربی و ورزشکار", href: "/admin/tickets", icon: Ticket, permission: "support" },
    ],
  },
  {
    title: "تنظیمات",
    items: [
      { label: "مدیریت بخش‌ها", href: "/admin/features", icon: ToggleRight, permission: "settings" },
      { label: "تنظیمات سایت", href: "/admin/settings", icon: Settings, permission: "settings" },
      { label: "برند و ظاهر", href: "/admin/branding", icon: Palette, permission: "settings" },
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
      { label: "خطاهای سایت", href: "/admin/errors", icon: Bug, permission: "system" },
      { label: "فضای هاست", href: "/admin/storage", icon: HardDrive, permission: "system" },
      { label: "سطل زباله", href: "/admin/trash", icon: Trash2 },
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
