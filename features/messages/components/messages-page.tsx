"use client";

import { useSearchParams } from "next/navigation";

import { RoleGate } from "@/features/authentication/components/role-gate";
import { useAuthContext } from "@/features/authentication/hooks/use-auth-context";
import { MessageInbox } from "./message-inbox";

export function MessagesPage() {
  const { data: context } = useAuthContext();
  // `?with=<user id>` opens one conversation directly — what the
  // notification for a new message links to.
  const counterpartId = useSearchParams().get("with");
  const role = context?.accountType;
  const isAthlete = role === "athlete";

  return (
    <RoleGate allow={["athlete", "trainer"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">پیام‌ها</h1>
          <p className="text-sm text-muted-foreground">
            {isAthlete
              ? "با مربی خود گفتگو کنید — درباره برنامه‌ها یا هر سوال دیگری."
              : "گفتگوی مستقیم با ورزشکاران، درباره برنامه‌ها یا هر موضوع دیگری."}
          </p>
        </div>

        {context && (role === "athlete" || role === "trainer") && (
          <MessageInbox
            currentUserId={context.userId}
            role={role}
            initialCounterpartId={counterpartId}
          />
        )}
      </div>
    </RoleGate>
  );
}
