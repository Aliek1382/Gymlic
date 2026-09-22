"use client";

import { useSearchParams } from "next/navigation";

import { RoleGate } from "@/features/authentication/components/role-gate";
import { useAuthContext } from "@/features/authentication/hooks/use-auth-context";
import { MemberManagement } from "./member-management";

export function MembersPage() {
  const { data: context } = useAuthContext();
  const openAdd = useSearchParams().get("new");
  const clubId = context?.activeMembership?.clubId;

  return (
    <RoleGate allow={["club"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">اعضا</h1>
          <p className="text-sm text-muted-foreground">
            اعضای باشگاه را دعوت کنید، طرح و وضعیت عضویتشان را مدیریت کنید و
            دعوت‌های در انتظار را پیگیری کنید.
          </p>
        </div>

        {clubId && (
          <MemberManagement clubId={clubId} openAddOnMount={openAdd === "1"} />
        )}
      </div>
    </RoleGate>
  );
}
