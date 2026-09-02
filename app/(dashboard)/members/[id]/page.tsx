import { notFound, redirect } from "next/navigation";

import { getServerAuthContext } from "@/features/authentication/services/auth-server";
import { MemberProfilePage } from "@/features/members";

export const metadata = { title: "پروفایل عضو | جیم‌لیک" };

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "club") redirect("/dashboard");

  const { id } = await params;
  const clubId = context.activeMembership!.clubId;

  // The profile is read through the browser client on the client side, so
  // this page only needs to know the membership belongs to this club.
  if (!id) notFound();

  return <MemberProfilePage clubId={clubId} membershipId={id} />;
}
