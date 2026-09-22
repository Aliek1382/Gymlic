"use client";

import { RoleGate } from "@/features/authentication/components/role-gate";
import { useAuthContext } from "@/features/authentication/hooks/use-auth-context";
import { PlanBrowser } from "./plan-browser";

const COPY = {
  workout: {
    heading: "برنامه‌های تمرینی",
    description:
      "یک ورزشکار را انتخاب کنید تا همه برنامه‌های تمرینی ثبت‌شده برای او را ببینید.",
  },
  nutrition: {
    heading: "برنامه‌های غذایی",
    description:
      "یک ورزشکار را انتخاب کنید تا همه برنامه‌های غذایی ثبت‌شده برای او را ببینید.",
  },
} as const;

/** The trainer's view of their athletes' plans — /workout-programs and
 *  /nutrition-programs differ only in copy. */
export function PlanBrowserPage({ kind }: { kind: "workout" | "nutrition" }) {
  const { data: context } = useAuthContext();
  const copy = COPY[kind];
  const trainerName =
    [context?.firstName, context?.lastName].filter(Boolean).join(" ") || null;

  return (
    <RoleGate allow={["trainer"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">{copy.heading}</h1>
          <p className="text-sm text-muted-foreground">{copy.description}</p>
        </div>

        {context && (
          <PlanBrowser
            kind={kind}
            currentUserId={context.userId}
            trainerName={trainerName}
            trainerAvatarUrl={context.avatarUrl}
          />
        )}
      </div>
    </RoleGate>
  );
}
