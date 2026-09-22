"use client";

import { useSearchParams } from "next/navigation";

import { RoleGate } from "@/features/authentication/components/role-gate";
import { useAuthContext } from "@/features/authentication/hooks/use-auth-context";
import { TrainerManagement } from "./trainer-management";

export function TrainersPage() {
  const { data: context } = useAuthContext();
  const openAdd = useSearchParams().get("new");
  const clubId = context?.activeMembership?.clubId;

  return (
    <RoleGate allow={["club"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">مربیان</h1>
          <p className="text-sm text-muted-foreground">
            مربیان باشگاه را دعوت و مدیریت کنید. شاگردان هر مربی هم به‌عنوان عضو
            باشگاه ثبت می‌شوند.
          </p>
        </div>

        {clubId && (
          <TrainerManagement clubId={clubId} openAddOnMount={openAdd === "1"} />
        )}
      </div>
    </RoleGate>
  );
}
