"use client";

import Link from "next/link";
import { MoreVertical, Users } from "lucide-react";

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
import { formatPersianDate } from "@/lib/persian";
import { EmptyState } from "../shared/empty-state";
import { ACTIVITY_STATUS_LABEL } from "../../constants/dashboard";
import type {
  ActivityStatus,
  RecentActivityItem,
} from "../../types/dashboard-types";

const STATUS_VARIANT: Record<ActivityStatus, "success" | "warning" | "secondary"> = {
  active: "success",
  pending: "warning",
  cancelled: "secondary",
};

export function RecentActivitiesTable({
  activities,
}: {
  activities: RecentActivityItem[];
}) {
  return (
    <Card className="gap-4 py-5">
      <div className="flex items-center justify-between px-6">
        <CardTitle className="text-base">فعالیت‌های اخیر</CardTitle>
        <Link
          href="/members"
          className="text-sm font-medium text-primary hover:underline"
        >
          مشاهده همه سوابق
        </Link>
      </div>

      {activities.length === 0 ? (
        <div className="px-6">
          <EmptyState icon={Users} title="هنوز فعالیتی ثبت نشده است." />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>عضو</TableHead>
              <TableHead>طرح</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead>تاریخ</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.map((activity) => (
              <TableRow key={activity.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs">
                        {activity.memberInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">
                        {activity.memberName}
                      </p>
                      {activity.memberEmail && (
                        <p className="text-xs text-muted-foreground" dir="ltr">
                          {activity.memberEmail}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {activity.planName}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[activity.status]}>
                    {ACTIVITY_STATUS_LABEL[activity.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatPersianDate(new Date(activity.date))}
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                    aria-label="عملیات"
                  >
                    <MoreVertical className="size-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
