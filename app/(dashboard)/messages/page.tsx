import { redirect } from "next/navigation";

import { getServerAuthContext } from "@/features/authentication/services/auth-server";
import { MessageInbox } from "@/features/messages";

export const metadata = { title: "پیام‌ها | جیم‌لیک" };

export default async function MessagesPage({
  searchParams,
}: {
  // `?with=<user id>` opens one conversation directly — what the
  // notification for a new message links to.
  searchParams: Promise<{ with?: string }>;
}) {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "athlete" && context.accountType !== "trainer") {
    redirect("/dashboard");
  }

  const { with: counterpartId } = await searchParams;
  const isAthlete = context.accountType === "athlete";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">پیام‌ها</h1>
        <p className="text-sm text-muted-foreground">
          {isAthlete
            ? "با مربی خود گفتگو کنید — درباره برنامه‌ها یا هر سوال دیگری."
            : "گفتگوی مستقیم با ورزشکاران، درباره برنامه‌ها یا هر موضوع دیگری."}
        </p>
      </div>

      <MessageInbox
        currentUserId={context.userId}
        role={context.accountType}
        initialCounterpartId={counterpartId ?? null}
      />
    </div>
  );
}
