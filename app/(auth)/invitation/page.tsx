import { redirect } from "next/navigation";

import { AuthShell, InvitationForm } from "@/features/authentication";
import { getServerAuthContext } from "@/features/authentication/services/auth-server";

export const metadata = { title: "تایید دعوت | جیم‌لیک" };

export default async function InvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (!context.accountType) redirect("/choose-role");
  if (context.accountType !== "athlete") redirect("/dashboard");
  if (context.hasTrainer) redirect("/dashboard");

  const { code } = await searchParams;

  return (
    <AuthShell
      title="اتصال به مربی"
      description="کد دعوتی که مربی شما در اختیارتان گذاشته را وارد کنید."
    >
      <InvitationForm defaultCode={code} />
    </AuthShell>
  );
}
