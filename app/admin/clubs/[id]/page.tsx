import { notFound } from "next/navigation";

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
import { createClient } from "@/lib/supabase/server";
import { ClubStatusToggle } from "@/features/admin/components/club-status-toggle";
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

export default async function AdminClubDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: club }, { data: memberships }, { data: paymentRequests }] =
    await Promise.all([
      supabase
        .from("clubs")
        .select(
          "id, name, status, member_capacity, created_at, owner:profiles!owner_id(first_name, last_name, phone, email), subscriptions(status, plan_name, started_at, expires_at)"
        )
        .eq("id", id)
        .maybeSingle()
        .returns<{
          id: string;
          name: string;
          status: ClubStatus;
          member_capacity: number | null;
          created_at: string;
          owner: { first_name: string | null; last_name: string | null; phone: string | null; email: string | null } | null;
          subscriptions: { status: SubscriptionStatus; plan_name: string; started_at: string; expires_at: string }[];
        } | null>(),
      supabase
        .from("memberships")
        .select("role, joined_at, profiles(first_name, last_name, phone)")
        .eq("club_id", id)
        .eq("status", "active")
        .order("joined_at", { ascending: false })
        .returns<
          {
            role: string;
            joined_at: string;
            profiles: { first_name: string | null; last_name: string | null; phone: string | null } | null;
          }[]
        >(),
      supabase
        .from("payment_requests")
        .select("id, amount_toman, reference_note, status, admin_note, created_at, reviewed_at, plans(name)")
        .eq("club_id", id)
        .order("created_at", { ascending: false })
        .returns<
          {
            id: string;
            amount_toman: number;
            reference_note: string | null;
            status: PaymentRequestStatus;
            admin_note: string | null;
            created_at: string;
            reviewed_at: string | null;
            plans: { name: string } | null;
          }[]
        >(),
    ]);

  if (!club) notFound();

  const ownerName =
    [club.owner?.first_name, club.owner?.last_name].filter(Boolean).join(" ") ||
    "بدون نام";
  const subscription = club.subscriptions?.[0];
  const memberRows = memberships ?? [];
  const athleteCount = memberRows.filter((m) => m.role === "athlete").length;
  const trainerCount = memberRows.filter((m) => m.role === "trainer").length;
  const requests = paymentRequests ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{club.name}</h1>
          <p className="text-sm text-muted-foreground">
            صاحب باشگاه: {ownerName}
            {club.owner?.phone && (
              <span dir="ltr"> · {club.owner.phone}</span>
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
            {subscription ? (
              <div className="mt-2 space-y-1">
                <Badge variant={SUB_STATUS_VARIANT[subscription.status]}>
                  {SUB_STATUS_LABEL[subscription.status]}
                </Badge>
                <p className="text-sm text-foreground">{subscription.plan_name}</p>
                <p className="text-xs text-muted-foreground">
                  انقضا: {formatPersianDate(new Date(subscription.expires_at))}
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
                  [member.profiles?.first_name, member.profiles?.last_name]
                    .filter(Boolean)
                    .join(" ") || "بدون نام";
                return (
                  <TableRow key={index}>
                    <TableCell className="font-medium text-foreground">{memberName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {ROLE_LABEL[member.role] ?? member.role}
                    </TableCell>
                    <TableCell className="text-muted-foreground" dir="ltr">
                      {member.profiles?.phone ?? "—"}
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
                    {request.plans?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatToman(request.amount_toman)} تومان
                  </TableCell>
                  <TableCell>
                    <Badge variant={REQUEST_STATUS_VARIANT[request.status]}>
                      {REQUEST_STATUS_LABEL[request.status]}
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
