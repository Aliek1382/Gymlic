"use client";

import Link from "next/link";
import { UserX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import { useMemberProfile } from "../hooks/use-member-profile";
import { MemberProfileView } from "./member-profile-view";

/** Loads one member's file and hands it to the read-only profile view. */
export function MemberProfilePage({
  clubId,
  membershipId,
}: {
  clubId: string;
  membershipId: string;
}) {
  const profile = useMemberProfile(clubId, membershipId);

  if (profile.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (profile.isError) {
    return <ErrorState message="دریافت اطلاعات عضو با خطا مواجه شد." />;
  }

  if (!profile.data) {
    return (
      <Card className="py-5">
        <EmptyState
          icon={UserX}
          title="این عضو پیدا نشد."
          description="ممکن است عضویت او از باشگاه شما حذف شده باشد."
        />
        <div className="flex justify-center">
          <Button asChild variant="outline">
            <Link href="/members">بازگشت به فهرست اعضا</Link>
          </Button>
        </div>
      </Card>
    );
  }

  return <MemberProfileView clubId={clubId} profile={profile.data} />;
}
