"use client";

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
import { formatNumber, formatPersianDate, formatToman } from "@/lib/persian";
import { useQuery } from "@tanstack/react-query";

import { getAdminClubDetail } from "../services/admin-service";
import { useSearchParams } from "next/navigation";


import { NotFoundNotice } from "@/components/not-found-notice";
import { RouteLoading } from "@/components/layout/route-loading";
import { ClubStatusToggle } from "./club-status-toggle";
import type {
  ClubStatus,
  PaymentRequestStatus,
  SubscriptionStatus,
} from "@/types/database.types";

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

const ROLE_LABEL: Record<string, string> = {
  owner: "صاحب باشگاه",
  trainer: "مربی",
  reception: "پذیرش",
  athlete: "ورزشکار",
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

const REQUEST_STATUS_LABEL: Record<PaymentRequestStatus, string> = {
  pending: "در انتظار",
  approved: "تاییدشده",
  rejected: "ردشده",
};

const REQUEST_STATUS_VARIANT: Record<PaymentRequestStatus, "warning" | "success" | "destructive"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
};

export function AdminClubDetailPage() {
  // Was /admin/clubs/[id]; a static export cannot emit a page per club, so
  // the id travels in the query string and <Link> navigation stays client-side.
  const id = useSearchParams().get("id") ?? "";

  const { data, isPending } = useQuery({
    queryKey: ["admin", "club", id],
    enabled: id.length > 0,
    queryFn: () => getAdminClubDetail(id),
  });

  if (isPending) return <RouteLoading />;

  const club = data?.club;
  if (!club) {
    return (
      <NotFoundNotice
        title="باشگاه پیدا نشد"
        description="این باشگاه وجود ندارد یا حذف شده است."
      />
    );
  }

  const ownerName =
    [club.owner_first_name, club.owner_last_name].filter(Boolean).join(" ") ||
    "بدون نام";
  const memberRows = data?.members ?? [];
  const athleteCount = memberRows.filter((m) => m.role === "athlete").length;
  const trainerCount = memberRows.filter((m) => m.role === "trainer").length;
  const requests = data?.payment_requests ?? [];

  return (

    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{club.name}</h1>
          <p className="text-sm text-muted-foreground">
            صاحب باشگاه: {ownerName}
            {club.owner_phone && (
              <span dir="ltr"> · {club.owner_phone}</span>
            )}
          </p>
        </div>
        <ClubStatusToggle clubId={club.id} status={club.status} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="gap-2 py-5">
          <div className="px-6">
            <p className="text-sm text-muted-foreground">وضعیت باشگاه</p>
            <Badge className="mt-2" variant={CLUB_STATUS_VARIANT[club.status]}>
              {CLUB_STATUS_LABEL[club.status]}
            </Badge>
          </div>
        </Card>
        <Card className="gap-2 py-5">
          <div className="px-6">
            <p className="text-sm text-muted-foreground">اشتراک فعلی</p>
            {club.subscription_status ? (
              <div className="mt-2 space-y-1">
                <Badge
                  variant={SUB_STATUS_VARIANT[club.subscription_status as SubscriptionStatus]}
                >
                  {SUB_STATUS_LABEL[club.subscription_status as SubscriptionStatus]}
                </Badge>
                <p className="text-sm text-foreground">{club.plan_name}</p>
                <p className="text-xs text-muted-foreground">
                  انقضا:{" "}
                  {formatPersianDate(new Date(club.subscription_expires_at as string))}
                </p>
              </div>
            ) : (
              <Badge className="mt-2" variant="secondary">
                بدون اشتراک
              </Badge>
            )}
          </div>
        </Card>
        <Card className="gap-2 py-5">
          <div className="px-6">
            <p className="text-sm text-muted-foreground">اعضا</p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {formatNumber(athleteCount)} ورزشکار · {formatNumber(trainerCount)} مربی
            </p>
            <p className="text-xs text-muted-foreground">
              {club.member_capacity != null
                ? `سقف اعضا طبق پلن: ${formatNumber(club.member_capacity)} نفر`
                : "بدون سقف تعیین‌شده برای تعداد اعضا"}
            </p>
            <p className="text-xs text-muted-foreground">
              ثبت‌نام: {formatPersianDate(new Date(club.created_at))}
            </p>
          </div>
        </Card>
      </div>

      <Card className="gap-4 py-5">
        <div className="px-6">
          <CardTitle className="text-base">
            اعضای باشگاه ({formatNumber(memberRows.length)})
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            نمای فقط‌خواندنی برای پشتیبانی — بدون امکان ورود به‌جای کاربر.
          </p>
        </div>

        {memberRows.length === 0 ? (
          <p className="px-6 text-sm text-muted-foreground">
            این باشگاه هنوز عضوی ندارد.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>نام</TableHead>
                <TableHead>نقش</TableHead>
                <TableHead>تماس</TableHead>
                <TableHead>تاریخ عضویت</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberRows.map((member, index) => {
                const memberName =
                  [member.first_name, member.last_name]
                    .filter(Boolean)
                    .join(" ") || "بدون نام";
                return (
                  <TableRow key={index}>
                    <TableCell className="font-medium text-foreground">{memberName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {ROLE_LABEL[member.role] ?? member.role}
                    </TableCell>
                    <TableCell className="text-muted-foreground" dir="ltr">
                      {member.phone ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatPersianDate(new Date(member.joined_at))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card className="gap-4 py-5">
        <div className="px-6">
          <CardTitle className="text-base">
            تاریخچه درخواست‌های پرداخت ({formatNumber(requests.length)})
          </CardTitle>
        </div>

        {requests.length === 0 ? (
          <p className="px-6 text-sm text-muted-foreground">
            این باشگاه هنوز درخواست پرداختی ثبت نکرده است.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>پلن</TableHead>
                <TableHead>مبلغ</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead>تاریخ ثبت</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="text-foreground">
                    {request.plan_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatToman(request.amount_toman)} تومان
                  </TableCell>
                  <TableCell>
                    <Badge variant={REQUEST_STATUS_VARIANT[request.status as PaymentRequestStatus]}>
                      {REQUEST_STATUS_LABEL[request.status as PaymentRequestStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatPersianDate(new Date(request.created_at))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
