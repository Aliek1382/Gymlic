import { redirect } from "next/navigation";
import { Dumbbell } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";
import { getServerAuthContext } from "@/features/authentication/services/auth-server";

export const metadata = { title: "مربیان | جیم‌لیک" };

export default async function TrainersPage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "club") redirect("/dashboard");

  return (
    <ComingSoon
      icon={Dumbbell}
      title="مدیریت مربیان"
      description="به‌زودی می‌توانید مربیان باشگاه را از همین‌جا دعوت، مدیریت و بررسی کنید."
    />
  );
}
