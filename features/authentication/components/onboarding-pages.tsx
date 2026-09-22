"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { RouteLoading } from "@/components/layout/route-loading";
import { useAuthContext } from "../hooks/use-auth-context";
import { AuthShell } from "./auth-shell";
import { CreateClubForm } from "./create-club-form";
import { InvitationForm } from "./invitation-form";
import { RoleSelector } from "./role-selector";

/**
 * The three onboarding steps between signing in and reaching the panel. Each
 * used to resolve its own ServerAuthContext and redirect(); on a static host
 * they share one client-side session read and replace() instead.
 */

export function ChooseRolePage() {
  const router = useRouter();
  const { data: context, isPending } = useAuthContext();

  useEffect(() => {
    if (isPending) return;
    if (!context) {
      router.replace("/login");
      return;
    }
    // Role already chosen — send the user to the next appropriate step
    // instead of letting them pick again (Redirect Rules #7).
    if (context.accountType === "club" && !context.activeMembership) {
      router.replace("/create-club");
      return;
    }
    if (context.accountType === "athlete" && !context.hasTrainer) {
      router.replace("/invitation");
      return;
    }
    if (context.accountType) router.replace("/dashboard");
  }, [context, isPending, router]);

  if (isPending || !context || context.accountType) return <RouteLoading />;

  return (
    <AuthShell
      title="نقش خود را انتخاب کنید"
      description="برای شروع، مشخص کنید در جیم‌لیک چه نقشی دارید."
    >
      <RoleSelector />
    </AuthShell>
  );
}

export function CreateClubPage() {
  const router = useRouter();
  const { data: context, isPending } = useAuthContext();

  useEffect(() => {
    if (isPending) return;
    if (!context) {
      router.replace("/login");
      return;
    }
    if (!context.accountType) {
      router.replace("/choose-role");
      return;
    }
    if (context.activeMembership) router.replace("/dashboard");
  }, [context, isPending, router]);

  if (isPending || !context || !context.accountType || context.activeMembership) {
    return <RouteLoading />;
  }

  // A Trainer may later create a Club and become its Owner — creating a club
  // is optional for trainers, mandatory for the "club" role.
  const skippable = context.accountType === "trainer";

  return (
    <AuthShell
      title="ساخت باشگاه"
      description="اطلاعات اولیه باشگاه خود را وارد کنید."
    >
      <CreateClubForm skippable={skippable} />
    </AuthShell>
  );
}

export function InvitationPage() {
  const router = useRouter();
  const { data: context, isPending } = useAuthContext();
  const code = useSearchParams().get("code") ?? undefined;

  useEffect(() => {
    if (isPending) return;
    if (!context) {
      router.replace("/login");
      return;
    }
    if (!context.accountType) {
      router.replace("/choose-role");
      return;
    }
    if (context.accountType !== "athlete" || context.hasTrainer) {
      router.replace("/dashboard");
    }
  }, [context, isPending, router]);

  if (
    isPending ||
    !context ||
    context.accountType !== "athlete" ||
    context.hasTrainer
  ) {
    return <RouteLoading />;
  }

  return (
    <AuthShell
      title="اتصال به مربی"
      description="کد دعوتی که مربی شما در اختیارتان گذاشته را وارد کنید."
    >
      <InvitationForm defaultCode={code} />
    </AuthShell>
  );
}

/**
 * /login is the one public path a signed-in visitor gets bounced off, which
 * the middleware used to do before the page was ever rendered.
 */
export function LoginRedirectGuard() {
  const router = useRouter();
  const { data: context, isPending } = useAuthContext();

  useEffect(() => {
    if (!isPending && context) router.replace("/dashboard");
  }, [context, isPending, router]);

  return null;
}
