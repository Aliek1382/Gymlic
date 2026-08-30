import "server-only";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export interface AdminContext {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
}

/**
 * Gate for the whole /admin route group. Returns null for anyone without
 * profiles.is_platform_admin set — including a signed-out visitor — so the
 * layout can redirect in one place rather than every page re-checking it.
 * That flag has no in-app way to be granted (see 0021/0023 migrations); it
 * is set by hand in Supabase.
 */
export const getAdminContext = cache(async function getAdminContext(): Promise<AdminContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, avatar_url, is_platform_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_platform_admin) return null;

  return {
    userId: user.id,
    fullName:
      [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
      "مدیر کل",
    avatarUrl: profile.avatar_url,
  };
});
