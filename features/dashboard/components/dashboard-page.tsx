"use client";

import dynamic from "next/dynamic";

import { RoleGate } from "@/features/authentication/components/role-gate";
import { useAuthContext } from "@/features/authentication/hooks/use-auth-context";
import { DashboardSkeleton } from "./shared/dashboard-skeleton";

// A user's accountType never changes mid-session, so they only ever render
// one of these three — but a static import would still ship all three
// variants' code (and every hook/component they pull in) to every visitor.
// Code-splitting means a club owner never downloads the trainer or athlete
// dashboard's JS, and vice versa.
const ClubDashboard = dynamic(
  () => import("./club/club-dashboard").then((m) => m.ClubDashboard),
  { ssr: false, loading: () => <DashboardSkeleton /> }
);
const TrainerDashboard = dynamic(
  () => import("./trainer/trainer-dashboard").then((m) => m.TrainerDashboard),
  { ssr: false, loading: () => <DashboardSkeleton /> }
);
const AthleteDashboard = dynamic(
  () => import("./athlete/athlete-dashboard").then((m) => m.AthleteDashboard),
  { ssr: false, loading: () => <DashboardSkeleton /> }
);

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
          trainerVerified={context.trainerVerified}
        />
      ) : null}
    </RoleGate>
  );
}
