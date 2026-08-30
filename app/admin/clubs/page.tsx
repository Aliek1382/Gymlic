import Link from "next/link";
import { Users } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber, formatPersianDate } from "@/lib/persian";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import type { ClubStatus, SubscriptionStatus } from "@/types/database.types";

export const metadata = { title: "باشگاه‌ها | پنل مدیریت جیم‌لیک" };

const CLUB_STATUS_LABEL: Record<ClubStatus, string> = {
  active: "فعال",
  suspended: "معلق",
};

const CLUB_STATUS_VARIANT: Record<ClubStatus, "success" | "destructive"> = {
  active: "success",
  suspended: "destructive",
};

const SUB_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: "فعال",
  expiring: "در حال انقضا",
  expired: "منقضی",
};

const SUB_STATUS_VARIANT: Record<SubscriptionStatus, "success" | "warning" | "destructive"> = {
  active: "success",
  expiring: "warning",
  expired: "destructive",
};

export default async function AdminClubsPage() {
  const supabase = await createClient();

  const [{ data: clubs }, { data: memberships }] = await Promise.all([
    supabase
      .from("clubs")
      .select(
        "id, name, status, created_at, owner:profiles!owner_id(first_name, last_name, phone), subscriptions(status, plan_name, expires_at)"
      )
      .order("created_at", { ascending: false })
      .returns<
        {
          id: string;
          name: string;
          status: ClubStatus;
          created_at: string;
          owner: { first_name: string | null; last_name: string | null; phone: string | null } | null;
          subscriptions: { status: SubscriptionStatus; plan_name: string; expires_at: string }[];
        }[]
      >(),
    supabase.from("memberships").select("club_id, role").eq("status", "active"),
  ]);

  const memberCounts = new Map<string, number>();
  for (const m of memberships ?? []) {
    if (m.role !== "athlete") continue;
    memberCounts.set(m.club_id, (memberCounts.get(m.club_id) ?? 0) + 1);
  }

  const rows = clubs ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">باشگاه‌ها</h1>
        <p className="text-sm text-muted-foreground">
          همه باشگاه‌های ثبت‌شده در پلتفرم و وضعیت اشتراک آن‌ها.
        </p>
      </div>

      <Card className="gap-4 py-5">
        <div className="px-6">
          <CardTitle className="text-base">
            لیست باشگاه‌ها ({formatNumber(rows.length)})
          </CardTitle>
        </div>

        {rows.length === 0 ? (
          <div className="px-6">
            <EmptyState
              icon={Users}
              title="هنوز باشگاهی ثبت نشده است."
              description="با ثبت‌نام اولین باشگاه، اطلاعاتش اینجا نمایش داده می‌شود."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>باشگاه</TableHead>
                <TableHead>صاحب باشگاه</TableHead>
                <TableHead>اعضا</TableHead>
                <TableHead>وضعیت باشگاه</TableHead>
                <TableHead>اشتراک</TableHead>
                <TableHead>تاریخ ثبت‌نام</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((club) => {
                const ownerName =
                  [club.owner?.first_name, club.owner?.last_name].filter(Boolean).join(" ") ||
                  "بدون نام";
                const subscription = club.subscriptions?.[0];

                return (
                  <TableRow key={club.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/admin/clubs/${club.id}`} className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs">
                            {club.name.slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <p className="font-medium text-foreground">{club.name}</p>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <p className="text-foreground">{ownerName}</p>
                      {club.owner?.phone && (
                        <p className="text-xs text-muted-foreground" dir="ltr">
                          {club.owner.phone}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatNumber(memberCounts.get(club.id) ?? 0)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={CLUB_STATUS_VARIANT[club.status]}>
                        {CLUB_STATUS_LABEL[club.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {subscription ? (
                        <Badge variant={SUB_STATUS_VARIANT[subscription.status]}>
                          {SUB_STATUS_LABEL[subscription.status]}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">بدون اشتراک</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatPersianDate(new Date(club.created_at))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
