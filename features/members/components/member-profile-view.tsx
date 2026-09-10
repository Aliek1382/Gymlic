"use client";

import Link from "next/link";
import {
  Apple,
  ArrowRight,
  CalendarCheck2,
  Dumbbell,
  Ruler,
  Wallet,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { parseIsoDate } from "@/lib/iso-date";
import {
  formatNumber,
  formatPersianDate,
  formatToman,
  toPersianDigits,
} from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { REVENUE_CATEGORY_LABEL } from "@/features/revenue";
import {
  MEMBER_STATUS_LABEL,
  MEMBER_STATUS_VARIANT,
  NO_PLAN_LABEL,
} from "../constants/members";
import { daysUntilExpiry, expiryState } from "../utils/membership-expiry";
import type { MemberProfile as MemberProfileData } from "../types/member-types";
import { MemberProfileActions } from "./member-profile-actions";

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-4 py-5">
      <div className="px-6">
        <CardTitle className="text-base">{title}</CardTitle>
      </div>
      <div className="space-y-2 px-6">{children}</div>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function ExpiryValue({ expiresAt }: { expiresAt: string | null }) {
  const state = expiryState(expiresAt);
  const days = daysUntilExpiry(expiresAt);

  if (!expiresAt || days === null) return <>بدون تاریخ پایان</>;

  const date = formatPersianDate(parseIsoDate(expiresAt));
  if (state === "expired") {
    return (
      <span className="flex items-center gap-2">
        {date}
        <Badge variant="destructive">منقضی‌شده</Badge>
      </span>
    );
  }
  if (state === "expiring") {
    return (
      <span className="flex items-center gap-2">
        {date}
        <Badge variant="warning">
          {days === 0 ? "امروز" : `${toPersianDigits(days)} روز مانده`}
        </Badge>
      </span>
    );
  }
  return <>{date}</>;
}

/** One member's whole file, as the club sees it. */
export function MemberProfileView({
  clubId,
  profile,
}: {
  clubId: string;
  profile: MemberProfileData;
}) {
  const { member } = profile;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild className="-mr-2">
        <Link href="/members">
          <ArrowRight />
          بازگشت به فهرست اعضا
        </Link>
      </Button>

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            {member.avatarUrl && (
              <AvatarImage src={member.avatarUrl} alt={member.name} />
            )}
            <AvatarFallback className="text-lg">
              {member.name.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">{member.name}</h2>
              <Badge variant={MEMBER_STATUS_VARIANT[member.status]}>
                {MEMBER_STATUS_LABEL[member.status]}
              </Badge>
            </div>
            {member.phone && (
              <p className="text-sm text-muted-foreground" dir="ltr">
                {member.phone}
              </p>
            )}
          </div>
        </div>

        <MemberProfileActions clubId={clubId} member={member} />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="عضویت">
          <InfoRow label="طرح" value={member.planName ?? NO_PLAN_LABEL} />
          <InfoRow
            label="تاریخ عضویت"
            value={formatPersianDate(new Date(member.joinedAt))}
          />
          <InfoRow
            label="پایان عضویت"
            value={<ExpiryValue expiresAt={member.expiresAt} />}
          />
          <InfoRow
            label="مربی"
            value={
              profile.trainers.length > 0
                ? profile.trainers.map((t) => t.name).join("، ")
                : "بدون مربی"
            }
          />
          <InfoRow
            label="مجموع پرداختی"
            value={`${formatToman(profile.totalPaid)}`}
          />
          <InfoRow
            label="حضور در کلاس"
            value={
              profile.attendanceRate === null
                ? "ثبت نشده"
                : `${toPersianDigits(profile.attendanceRate)}٪`
            }
          />
        </SectionCard>

        <SectionCard title="تاریخچه‌ی پرداخت‌ها">
          {profile.payments.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="پرداختی برای این عضو ثبت نشده است."
              description="دریافتی‌ها را از بخش امور مالی ← درآمد باشگاه ثبت کنید."
            />
          ) : (
            profile.payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {formatNumber(payment.amount)} تومان
                    </span>
                    <Badge variant="secondary">
                      {REVENUE_CATEGORY_LABEL[payment.category]}
                    </Badge>
                  </div>
                  {payment.note && (
                    <p className="text-xs text-muted-foreground">{payment.note}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatPersianDate(parseIsoDate(payment.occurredOn))}
                </span>
              </div>
            ))
          )}
        </SectionCard>

        <SectionCard title="برنامه‌های تمرینی و غذایی">
          {profile.plans.length === 0 ? (
            <EmptyState
              icon={Dumbbell}
              title="برنامه‌ای برای این عضو ثبت نشده است."
              description="برنامه‌ها را مربی این عضو در پنل خودش می‌نویسد."
            />
          ) : (
            profile.plans.map((plan) => (
              <div
                key={`${plan.kind}-${plan.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {plan.kind === "workout" ? (
                    <Dumbbell className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <Apple className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate text-sm text-foreground">
                    {plan.title}
                  </span>
                  {plan.status === "completed" && (
                    <Badge variant="success">تکمیل‌شده</Badge>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatPersianDate(new Date(plan.updatedAt))}
                </span>
              </div>
            ))
          )}
        </SectionCard>

        <SectionCard title="اندازه‌گیری‌ها">
          {profile.measurements.length === 0 ? (
            <EmptyState
              icon={Ruler}
              title="اندازه‌گیری‌ای ثبت نشده است."
              description="وزن، قد و درصد چربی را ورزشکار یا مربی او ثبت می‌کند."
            />
          ) : (
            profile.measurements.map((measurement) => (
              <div
                key={measurement.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm"
              >
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                  {measurement.weightKg != null && (
                    <span>وزن {toPersianDigits(measurement.weightKg)} کیلوگرم</span>
                  )}
                  {measurement.heightCm != null && (
                    <span>قد {toPersianDigits(measurement.heightCm)} سانتی‌متر</span>
                  )}
                  {measurement.bodyFatPercent != null && (
                    <span>
                      چربی {toPersianDigits(measurement.bodyFatPercent)}٪
                    </span>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatPersianDate(new Date(measurement.recordedAt))}
                </span>
              </div>
            ))
          )}
        </SectionCard>
      </div>

      <SectionCard title="حضور در کلاس‌ها">
        {profile.attendance.length === 0 ? (
          <EmptyState
            icon={CalendarCheck2}
            title="حضوری برای این عضو ثبت نشده است."
            description="با فعال شدن ماژول کلاس‌ها، حضور و غیاب همین‌جا دیده می‌شود."
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {profile.attendance.map((entry) => (
              <Badge
                key={entry.id}
                variant={entry.attended ? "success" : "secondary"}
              >
                {formatPersianDate(parseIsoDate(entry.classDate))}
              </Badge>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
