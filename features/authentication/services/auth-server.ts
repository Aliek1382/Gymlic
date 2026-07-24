import "server-only";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { AccountType, MembershipRole } from "@/types/database.types";

export interface ServerAuthContext {
  userId: string;
  phone: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  accountType: AccountType | null;
  activeMembership: {
    clubId: string;
    role: MembershipRole;
    clubName: string;
  } | null;
  hasTrainer: boolean;
}

/**
 * Loads everything the Redirect Rules (Dashboard Pack #7) need to decide
 * where an authenticated user should land. Returns null when there is no
 * session — callers should redirect to /login in that case (middleware
 * already does this for protected routes, this is the belt-and-braces check
 * for Server Components that need the resolved data anyway).
 */
export const getServerAuthContext = cache(async function getServerAuthContext(): Promise<ServerAuthContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("phone, email, first_name, last_name, avatar_url, account_type")
    .eq("id", user.id)
    .maybeSingle();

  const { data: membership } = await supabase
    .from("memberships")
    .select("club_id, role, clubs(name)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle()
    .returns<{
      club_id: string;
      role: MembershipRole;
      clubs: { name: string } | null;
    }>();

  const { count: trainerCount } = await supabase
    .from("trainer_athletes")
    .select("id", { count: "exact", head: true })
    .eq("athlete_id", user.id)
    .eq("status", "active");

  return {
    userId: user.id,
    phone: profile?.phone || user.phone || null,
    email: profile?.email || user.email || null,
    firstName: profile?.first_name ?? null,
    lastName: profile?.last_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    accountType: (profile?.account_type as AccountType | null) ?? null,
    activeMembership: membership
      ? {
          clubId: membership.club_id,
          role: membership.role,
          clubName: membership.clubs?.name ?? "",
        }
      : null,
    hasTrainer: (trainerCount ?? 0) > 0,
  };
});
