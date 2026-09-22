"use client";

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
import { useQuery } from "@tanstack/react-query";

import { listAdminClubs } from "../services/admin-service";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import type { ClubStatus, SubscriptionStatus } from "@/types/database.types";

const CLUB_STATUS_LABEL: Record<ClubStatus, string> = {
  active: "فعال",
  suspended: "معلق",
  pending: "در انتظار تایید",
};

const CLUB_STATUS_VARIANT: Record<ClubStatus, "success" | "destructive" | "warning"> = {
  active: "success",
  suspended: "destructive",
  pending: "warning",
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

export function AdminClubsPage() {
  const { data } = useQuery({
    queryKey: ["admin", "clubs"],
    queryFn: async () => {
      const rows = [...(await listAdminClubs())].sort((a, b) => {
        // Pending clubs need attention first — above everything else
        // regardless of registration date.
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (b.status === "pending" && a.status !== "pending") return 1;
        return 0;
      });

      return {
        rows,
        pendingCount: rows.filter((club) => club.status === "pending").length,
      };
    },
  });

  const rows = data?.rows ?? [];
  const pendingCount = data?.pendingCount ?? 0;

  return (

    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">باشگاه‌ها</h1>
        <p className="text-sm text-muted-foreground">
          همه باشگاه‌های ثبت‌شده در پلتفرم و وضعیت اشتراک آن‌ها.
        </p>
      </div>

      <Card className="gap-4 py-5">
        <div className="flex items-center gap-2 px-6">
          <CardTitle className="text-base">
            لیست باشگاه‌ها ({formatNumber(rows.length)})
          </CardTitle>
          {pendingCount > 0 && (
            <Badge variant="warning">{formatNumber(pendingCount)} در انتظار تایید</Badge>
          )}
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
                  [club.owner_first_name, club.owner_last_name].filter(Boolean).join(" ") ||
                  "بدون نام";

                return (
                  <TableRow key={club.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/admin/clubs/detail?id=${club.id}`} className="flex items-center gap-3">
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
                      {club.owner_phone && (
                        <p className="text-xs text-muted-foreground" dir="ltr">
                          {club.owner_phone}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatNumber(club.member_count)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={CLUB_STATUS_VARIANT[club.status]}>
                        {CLUB_STATUS_LABEL[club.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {club.subscription_status ? (
                        <Badge
                          variant={
                            SUB_STATUS_VARIANT[club.subscription_status as SubscriptionStatus]
                          }
                        >
                          {SUB_STATUS_LABEL[club.subscription_status as SubscriptionStatus]}
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
