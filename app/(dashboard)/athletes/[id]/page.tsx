import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { getServerAuthContext } from "@/features/authentication/services/auth-server";
import { AthleteProfileContent } from "@/features/athletes";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "پروفایل ورزشکار | جیم‌لیک" };

export default async function AthleteProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "trainer") redirect("/dashboard");

  const supabase = await createClient();
  const { data: relation } = await supabase
    .from("trainer_athletes")
    .select("profiles!athlete_id(first_name, last_name)")
    .eq("trainer_id", context.userId)
    .eq("athlete_id", id)
    .eq("status", "active")
    .maybeSingle()
    .returns<{
      profiles: { first_name: string | null; last_name: string | null } | null;
    } | null>();

  if (!relation) notFound();

  const athleteName =
    [relation.profiles?.first_name, relation.profiles?.last_name]
      .filter(Boolean)
      .join(" ") || "ورزشکار";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/athletes"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          بازگشت به لیست ورزشکاران
        </Link>
        <h1 className="text-xl font-bold text-foreground">{athleteName}</h1>
        <p className="text-sm text-muted-foreground">
          برنامه‌ها، روند پیشرفت و یادداشت‌های خصوصی این ورزشکار.
        </p>
      </div>

      <AthleteProfileContent athleteId={id} />
    </div>
  );
}
