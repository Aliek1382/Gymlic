"use client";

import { RoleGate } from "@/features/authentication/components/role-gate";
import { useAuthContext } from "@/features/authentication/hooks/use-auth-context";
import { ClubDashboard } from "./club/club-dashboard";
import { TrainerDashboard } from "./trainer/trainer-dashboard";
import { AthleteDashboard } from "./athlete/athlete-dashboard";

export function DashboardPage() {
  const { data: context } = useAuthContext();

  // The (dashboard) layout already guarantees a session and an accountType
  // before this renders; the guards here are just narrowing for TypeScript.
  const name = context?.firstName ?? "کاربر";

  return (
    <RoleGate>
      {context?.accountType === "club" && context.activeMembership ? (
        <ClubDashboard
          ownerName={name}
          clubId={context.activeMembership.clubId}
        />
      ) : context?.accountType === "trainer" ? (
        <TrainerDashboard trainerName={name} />
      ) : context?.accountType === "athlete" ? (
        <AthleteDashboard
          athleteId={context.userId}
          athleteName={name}
          trainerName={context.trainerName}
        />
      ) : null}
    </RoleGate>
  );
}
