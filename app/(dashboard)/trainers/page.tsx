import { redirect } from "next/navigation";

import { getServerAuthContext } from "@/features/authentication/services/auth-server";
import { TrainerManagement } from "@/features/trainers";

export const metadata = { title: "مربیان | جیم‌لیک" };

export default async function TrainersPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "club") redirect("/dashboard");

  const { new: openAdd } = await searchParams;
  const clubId = context.activeMembership!.clubId;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">مربیان</h1>
        <p className="text-sm text-muted-foreground">
          مربیان باشگاه را دعوت و مدیریت کنید. شاگردان هر مربی هم به‌عنوان عضو
          باشگاه ثبت می‌شوند.
        </p>
      </div>

      <TrainerManagement clubId={clubId} openAddOnMount={openAdd === "1"} />
    </div>
  );
}
