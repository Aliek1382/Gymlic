"use client";

import { RoleGate } from "@/features/authentication/components/role-gate";
import { useAuthContext } from "@/features/authentication/hooks/use-auth-context";
import { MyPlanList } from "./my-plan-list";

const COPY = {
  workout: {
    heading: "برنامه تمرینی",
    description: "برنامه‌های تمرینی که مربی برای شما ثبت کرده است.",
    emptyTitle: "هنوز برنامه تمرینی ثبت نشده است.",
  },
  nutrition: {
    heading: "برنامه غذایی",
    description: "برنامه‌های غذایی که مربی برای شما ثبت کرده است.",
    emptyTitle: "هنوز برنامه غذایی ثبت نشده است.",
  },
} as const;

/** The athlete's own plans — /workout and /nutrition differ only in copy. */
export function MyPlanPage({ kind }: { kind: "workout" | "nutrition" }) {
  const { data: context } = useAuthContext();
  const copy = COPY[kind];
  const athleteName =
    [context?.firstName, context?.lastName].filter(Boolean).join(" ") || null;

  return (
    <RoleGate allow={["athlete"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">{copy.heading}</h1>
          <p className="text-sm text-muted-foreground">{copy.description}</p>
        </div>

        {context && (
          <MyPlanList
            kind={kind}
            emptyTitle={copy.emptyTitle}
            emptyDescription="به محض ثبت برنامه توسط مربی، اینجا نمایش داده می‌شود."
            currentUserId={context.userId}
            athleteName={athleteName}
            athleteBirthDate={context.birthDate}
            athleteAvatarUrl={context.avatarUrl}
            trainerName={context.trainerName}
            trainerAvatarUrl={context.trainerAvatarUrl}
          />
        )}
      </div>
    </RoleGate>
  );
}
