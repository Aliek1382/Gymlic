import { Frown } from "lucide-react";

import { AuthShell } from "@/features/authentication/components/auth-shell";
import { JoinForm } from "@/features/authentication/components/join-form";
import { getInvitationPreview } from "@/features/authentication/services/auth-server";

export const metadata = { title: "پیوستن به جیم‌لیک" };

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const invitation = await getInvitationPreview(code);

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

  return (
    <AuthShell
      title={name ? `خوش آمدید، ${name}` : "خوش آمدید"}
      description={`${
        invitation.clubName
          ? `باشگاه «${invitation.clubName}»`
          : "مربی شما"
      } شما را به جیم‌لیک دعوت کرده است. برای تکمیل ثبت‌نام، ایمیل و رمز عبور دلخواه خود را وارد کنید.`}
    >
      <JoinForm code={code} />
    </AuthShell>
  );
}
