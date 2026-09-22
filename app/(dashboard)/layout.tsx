"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Clock, ShieldAlert } from "lucide-react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { RouteLoading } from "@/components/layout/route-loading";
import { ROLE_LABEL } from "@/components/layout/sidebar-nav";
import { AccessBlockedNotice } from "@/components/access-blocked-notice";
import { useAuthContext } from "@/features/authentication/hooks/use-auth-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: context, isPending } = useAuthContext();

  // The Redirect Rules used to run in a Server Component, before any HTML was
  // sent. Under `output: "export"` the shell is already in the browser by the
  // time the session is known, so each rule becomes a client-side replace()
  // and the layout renders its loading state until one of them settles.
  useEffect(() => {
    if (isPending) return;

    if (!context) {
      router.replace("/login");
      return;
    }
    // Rule 2 / Rule 7 — role must be chosen before anything else.
    if (!context.accountType) {
      router.replace("/choose-role");
      return;
    }
    // Club role must own a club before reaching the panel.
    if (context.accountType === "club" && !context.activeMembership) {
      router.replace("/create-club");
      return;
    }
    // An Athlete reaches the panel through a Trainer, or — since clubs can
    // invite members directly — through an active club membership. With
    // neither, there is nothing to show them yet.
    if (
      context.accountType === "athlete" &&
      !context.hasTrainer &&
      !context.activeMembership
    ) {
      router.replace("/invitation");
    }
  }, [context, isPending, router]);

  if (isPending || !context) return <RouteLoading />;

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
    const isPendingClub = context.activeMembership.clubStatus === "pending";
    return (
      <AccessBlockedNotice
        icon={isPendingClub ? Clock : ShieldAlert}
        title={
          isPendingClub
            ? "باشگاه در انتظار تایید مدیریت است"
            : "دسترسی این باشگاه موقتاً معلق شده است"
        }
        description={
          isPendingClub
            ? `باشگاه «${context.activeMembership.clubName}» هنوز توسط مدیریت جیم‌لیک تایید نشده است. پس از تایید، دسترسی شما به‌طور خودکار فعال می‌شود.`
            : `باشگاه «${context.activeMembership.clubName}» توسط مدیریت جیم‌لیک معلق شده است. برای پیگیری با پشتیبانی تماس بگیرید.`
        }
      />
    );
  }

  // The effect above is already redirecting for each of these; rendering the
  // loading state keeps the panel from flashing in the meantime.
  if (!context.accountType) return <RouteLoading />;
  if (context.accountType === "club" && !context.activeMembership) {
    return <RouteLoading />;
  }
  if (
    context.accountType === "athlete" &&
    !context.hasTrainer &&
    !context.activeMembership
  ) {
    return <RouteLoading />;
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
