import { getServerAuthContext } from "@/features/authentication/services/auth-server";
import { ClubDashboard } from "@/features/dashboard/components/club/club-dashboard";
import { TrainerDashboard } from "@/features/dashboard/components/trainer/trainer-dashboard";
import { AthleteDashboard } from "@/features/dashboard/components/athlete/athlete-dashboard";

export const metadata = { title: "داشبورد | جیم‌لیک" };

export default async function DashboardPage() {
  const context = await getServerAuthContext();

  // The (dashboard) layout already guarantees `context` and `accountType`
  // exist before this page renders.
  const name = context!.firstName ?? "کاربر";

  switch (context!.accountType) {
    case "club":
      return <ClubDashboard ownerName={name} />;
    case "trainer":
      return <TrainerDashboard trainerName={name} />;
    case "athlete":
      return <AthleteDashboard athleteName={name} />;
    default:
      return null;
  }
}
