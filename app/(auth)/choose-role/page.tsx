import { redirect } from "next/navigation";

import { AuthShell, RoleSelector } from "@/features/authentication";
import { getServerAuthContext } from "@/features/authentication/services/auth-server";

export const metadata = { title: "انتخاب نقش | جیم‌لیک" };

export default async function ChooseRolePage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");

  // Role already chosen — send the user to the next appropriate step instead
  // of letting them pick again (Redirect Rules #7).
  if (context.accountType === "club" && !context.activeMembership) {
    redirect("/create-club");
  }
  if (context.accountType === "athlete" && !context.hasTrainer) {
    redirect("/invitation");
  }
  if (context.accountType) {
    redirect("/dashboard");
  }

  return (
    <AuthShell
      title="نقش خود را انتخاب کنید"
      description="برای شروع، مشخص کنید در جیم‌لیک چه نقشی دارید."
    >
      <RoleSelector />
    </AuthShell>
  );
}
