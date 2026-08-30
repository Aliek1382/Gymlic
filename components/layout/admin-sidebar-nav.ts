import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Dumbbell,
  History,
  LayoutGrid,
  Megaphone,
  ReceiptText,
  Tags,
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
];
