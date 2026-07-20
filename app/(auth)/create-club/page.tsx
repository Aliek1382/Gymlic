import { redirect } from "next/navigation";

import { AuthShell, CreateClubForm } from "@/features/authentication";
import { getServerAuthContext } from "@/features/authentication/services/auth-server";

export const metadata = { title: "ساخت باشگاه | جیم‌لیک" };

export default async function CreateClubPage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (!context.accountType) redirect("/choose-role");
  if (context.activeMembership) redirect("/dashboard");

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
