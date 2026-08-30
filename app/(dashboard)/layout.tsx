import { redirect } from "next/navigation";
import { Clock, ShieldAlert } from "lucide-react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ROLE_LABEL } from "@/components/layout/sidebar-nav";
import { AccessBlockedNotice } from "@/components/access-blocked-notice";
import { getServerAuthContext } from "@/features/authentication/services/auth-server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getServerAuthContext();

  // Rule 1: Dashboard (and every panel page) is only reachable with a
  // valid session. Middleware already redirects unauthenticated requests,
  // this is the defensive Server Component check.
  if (!context) redirect("/login");

  // A platform admin can suspend any account — block the panel entirely
  // rather than letting a suspended user reach a half-working dashboard.
  if (context.isSuspended) {
    return (
      <AccessBlockedNotice
        icon={ShieldAlert}
        title="حساب شما مسدود شده است"
        description="دسترسی شما به پنل جیم‌لیک توسط مدیریت پلتفرم موقتاً مسدود شده است. برای پیگیری با پشتیبانی تماس بگیرید."
      />
    );
  }

  // A club not yet approved by the platform admin (new default: 'pending'),
  // or one an admin has suspended, is unusable for everyone tied to it —
  // owner, trainer, or reception — until the admin flips it back to
  // 'active' in /admin/clubs.
  if (context.activeMembership && context.activeMembership.clubStatus !== "active") {
    const isPending = context.activeMembership.clubStatus === "pending";
    return (
      <AccessBlockedNotice
        icon={isPending ? Clock : ShieldAlert}
        title={
          isPending
            ? "باشگاه در انتظار تایید مدیریت است"
            : "دسترسی این باشگاه موقتاً معلق شده است"
        }
        description={
          isPending
            ? `باشگاه «${context.activeMembership.clubName}» هنوز توسط مدیریت جیم‌لیک تایید نشده است. پس از تایید، دسترسی شما به‌طور خودکار فعال می‌شود.`
            : `باشگاه «${context.activeMembership.clubName}» توسط مدیریت جیم‌لیک معلق شده است. برای پیگیری با پشتیبانی تماس بگیرید.`
        }
      />
    );
  }

  // Rule 2 / Rule 7 — Redirect Rules: role must be chosen before anything else.
  if (!context.accountType) redirect("/choose-role");

  // Club role must own a club before reaching the panel.
  if (context.accountType === "club" && !context.activeMembership) {
    redirect("/create-club");
  }

  // An Athlete must belong to at least one Trainer before reaching the panel.
  if (context.accountType === "athlete" && !context.hasTrainer) {
    redirect("/invitation");
  }

  const fullName =
    [context.firstName, context.lastName].filter(Boolean).join(" ") ||
    context.phone ||
    "کاربر جیم‌لیک";

  return (
    <DashboardShell
      accountType={context.accountType}
      fullName={fullName}
      roleLabel={ROLE_LABEL[context.accountType]}
      avatarUrl={context.avatarUrl}
      userId={context.userId}
    >
      {children}
    </DashboardShell>
  );
}
