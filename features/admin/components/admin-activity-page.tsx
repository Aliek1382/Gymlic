"use client";

import { History } from "lucide-react";

import { Card, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber, formatRelativeTime } from "@/lib/persian";
import { useQuery } from "@tanstack/react-query";

import { listAdminActivity } from "../services/admin-service";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";

const ADMIN_ACTIONS = [
  "subscription_activated",
  "payment_request_rejected",
  "club_status_changed",
  "profile_suspended_changed",
  "profile_edited_by_admin",
];

const ACTION_LABEL: Record<string, string> = {
  subscription_activated: "فعال‌سازی اشتراک باشگاه",
  payment_request_rejected: "رد درخواست پرداخت",
  club_status_changed: "تغییر وضعیت باشگاه",
  profile_suspended_changed: "تغییر وضعیت مسدودی حساب",
  profile_edited_by_admin: "ویرایش پروفایل توسط مدیر",
};

export function AdminActivityPage() {
  const { data } = useQuery({
    queryKey: ["admin", "activity"],
    queryFn: async () => ({
      rows: (await listAdminActivity()).filter((log) =>
        ADMIN_ACTIONS.includes(log.action)
      ),
    }),
  });

  const rows = data?.rows ?? [];

  return (

    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">لاگ فعالیت مدیر</h1>
        <p className="text-sm text-muted-foreground">
          ردیابی تمام اقداماتی که در پنل مدیریت انجام شده است.
        </p>
      </div>

      <Card className="gap-4 py-5">
        <div className="px-6">
          <CardTitle className="text-base">
            {formatNumber(rows.length)} رویداد اخیر
          </CardTitle>
        </div>

        {rows.length === 0 ? (
          <div className="px-6">
            <EmptyState
              icon={History}
              title="هنوز اقدامی ثبت نشده است."
              description="اقدامات شما در پنل مدیریت (تایید پرداخت، مسدودسازی و...) اینجا ثبت می‌شود."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>اقدام</TableHead>
                <TableHead>باشگاه</TableHead>
                <TableHead>مربوط به</TableHead>
                <TableHead>زمان</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((log) => {
                const subjectName =
                  [log.subject_first_name, log.subject_last_name].filter(Boolean).join(" ");
                return (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium text-foreground">
                      {ACTION_LABEL[log.action] ?? log.action}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.club_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {subjectName || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelativeTime(new Date(log.created_at))}
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
