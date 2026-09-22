"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { RoleGate } from "@/features/authentication/components/role-gate";
import { useAthleteProfile } from "../hooks/use-athlete-profile";
import { AthleteProfileContent } from "./athlete-profile-content";

/**
 * Was /athletes/[id]. A static export can only emit a dynamic segment it knows
 * at build time, so the athlete id moved into the query string — which also
 * keeps <Link> navigation client-side instead of forcing a full reload.
 */
export function AthleteProfilePage() {
  const athleteId = useSearchParams().get("id") ?? "";
  // Shares the cache entry AthleteProfileContent reads, so naming the heading
  // costs no extra request.
  const { data: profile } = useAthleteProfile(athleteId);

  return (
    <RoleGate allow={["trainer"]}>
      <div className="space-y-6">
        <div>
          <Link
            href="/athletes"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            بازگشت به لیست ورزشکاران
          </Link>
          <h1 className="text-xl font-bold text-foreground">
            {profile?.name ?? "ورزشکار"}
          </h1>
          <p className="text-sm text-muted-foreground">
            برنامه‌ها، روند پیشرفت و یادداشت‌های خصوصی این ورزشکار.
          </p>
        </div>

        {athleteId && <AthleteProfileContent athleteId={athleteId} />}
      </div>
    </RoleGate>
  );
}
