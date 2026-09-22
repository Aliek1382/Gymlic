"use client";

import { useSearchParams } from "next/navigation";

import { RoleGate } from "@/features/authentication/components/role-gate";
import { useAuthContext } from "@/features/authentication/hooks/use-auth-context";
import { MemberProfilePage } from "./member-profile-page";

/** Was /members/[id]; the membership id now travels in the query string. */
export function MemberProfileRoute() {
  const membershipId = useSearchParams().get("id") ?? "";
  const { data: context } = useAuthContext();
  const clubId = context?.activeMembership?.clubId;

  return (
    <RoleGate allow={["club"]}>
      {clubId && membershipId && (
        <MemberProfilePage clubId={clubId} membershipId={membershipId} />
      )}
    </RoleGate>
  );
}
