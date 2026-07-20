import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";
import { getServerAuthContext } from "@/features/authentication/services/auth-server";

export const metadata = { title: "امور مالی | جیم‌لیک" };

export default async function FinancePage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "club") redirect("/dashboard");

  return (
    <ComingSoon
      icon={Wallet}
      title="امور مالی باشگاه"
      description="گزارش درآمد، تراکنش‌ها و صورتحساب‌ها به‌زودی در این بخش نمایش داده می‌شود."
    />
  );
}
