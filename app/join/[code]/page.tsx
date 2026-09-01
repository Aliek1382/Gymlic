import { Frown } from "lucide-react";

import { AuthShell } from "@/features/authentication/components/auth-shell";
import { JoinForm } from "@/features/authentication/components/join-form";
import { JoinSignedInForm } from "@/features/authentication/components/join-signed-in-form";
import {
  getInvitationPreview,
  getServerAuthContext,
} from "@/features/authentication/services/auth-server";

export const metadata = { title: "پیوستن به جیم‌لیک" };

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const [invitation, context] = await Promise.all([
    getInvitationPreview(code),
    getServerAuthContext(),
  ]);

  if (!invitation) {
    return (
      <AuthShell
        title="لینک نامعتبر است"
        description="این لینک دعوت منقضی شده یا قبلاً استفاده شده است. برای دریافت لینک جدید با باشگاه یا مربی خود تماس بگیرید."
      >
        <div className="flex justify-center py-4 text-muted-foreground">
          <Frown className="size-10" />
        </div>
      </AuthShell>
    );
  }

  const name = [invitation.firstName, invitation.lastName]
    .filter(Boolean)
    .join(" ");

  const inviter = invitation.clubName
    ? `باشگاه «${invitation.clubName}»`
    : "مربی شما";
  const asRole = invitation.invitedRole === "trainer" ? "به‌عنوان مربی " : "";

  // Signing up is impossible for someone who already has an account, so a
  // signed-in visitor accepts the invite with the account they hold — the
  // usual case for a trainer already using Gymlic who is invited to a club.
  if (context) {
    const accountLabel =
      [context.firstName, context.lastName].filter(Boolean).join(" ") ||
      context.email ||
      context.phone ||
      "فعلی";

    return (
      <AuthShell
        title={name ? `خوش آمدید، ${name}` : "خوش آمدید"}
        description={`${inviter} شما را ${asRole}به جیم‌لیک دعوت کرده است.`}
      >
        <JoinSignedInForm
          code={code}
          invitedRole={invitation.invitedRole}
          accountLabel={accountLabel}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={name ? `خوش آمدید، ${name}` : "خوش آمدید"}
      description={`${inviter} شما را ${asRole}به جیم‌لیک دعوت کرده است. برای تکمیل ثبت‌نام، ایمیل و رمز عبور دلخواه خود را وارد کنید.`}
    >
      <JoinForm code={code} />
    </AuthShell>
  );
}
