import { redirect } from "next/navigation";

import { getServerAuthContext } from "@/features/authentication/services/auth-server";
import { MemberManagement } from "@/features/members";

export const metadata = { title: "اعضا | جیم‌لیک" };

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "club") redirect("/dashboard");

  const { new: openAdd } = await searchParams;
  const clubId = context.activeMembership!.clubId;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">اعضا</h1>
        <p className="text-sm text-muted-foreground">
          اعضای باشگاه را دعوت کنید، طرح و وضعیت عضویتشان را مدیریت کنید و
          دعوت‌های در انتظار را پیگیری کنید.
        </p>
      </div>

      <MemberManagement clubId={clubId} openAddOnMount={openAdd === "1"} />
    </div>
  );
}
