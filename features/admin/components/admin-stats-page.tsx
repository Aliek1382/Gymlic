"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, CalendarClock, UserPlus, Users, UserX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fullName } from "@/lib/api/client";
import {
  formatNumber,
  formatPercent,
  formatPersianDate,
  formatRelativeTime,
  formatShortPersianDate,
  toPersianDigits,
} from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import { SectionHeader } from "@/features/dashboard/components/shared/section-header";
import { StatisticCard } from "@/features/dashboard/components/shared/statistic-card";
import { StatisticsGrid } from "@/features/dashboard/components/shared/statistics-grid";
import { useAdminCan } from "../hooks/use-admin-access";
import {
  getAdminStats,
  type AdminStats,
  type StatsInactiveUser,
  type StatsSubscription,
} from "../services/admin-stats-service";

const ROLES = [
  { key: "club", label: "باشگاه", color: "var(--chart-1)" },
  { key: "trainer", label: "مربی", color: "var(--chart-3)" },
  { key: "athlete", label: "ورزشکار", color: "var(--chart-4)" },
  { key: "none", label: "بدون نقش", color: "var(--muted-foreground)" },
] as const;

const INACTIVE_OPTIONS = [7, 14, 30, 60, 90];

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card)",
  fontSize: 12,
};

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 };

/** A calendar day from the API ("2026-09-12"), at noon so no timezone moves it. */
function day(value: string): Date {
  return new Date(`${value.slice(0, 10)}T12:00:00`);
}

/** "از ۲۱ شهریور" — a week by its Saturday. */
function weekLabel(start: string): string {
  return formatShortPersianDate(day(start));
}

function changeBadge(now: number, before: number) {
  if (before === 0 && now === 0) return <span className="text-xs text-muted-foreground">—</span>;
  if (before === 0) return <Badge variant="success">تازه</Badge>;
  const change = (now - before) / before;
  const label = formatPercent(Math.round(change * 100));
  return (
    <Badge variant={change > 0.05 ? "success" : change < -0.05 ? "destructive" : "warning"}>{label}</Badge>
  );
}

/** /admin/stats — sign-ups, active users, who stopped coming, subscriptions running out, and which sections are used. */
export function AdminStatsPage() {
  const [inactiveDays, setInactiveDays] = useState(14);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "stats", inactiveDays],
    queryFn: () => getAdminStats(inactiveDays),
    placeholderData: (previous) => previous,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">آمار رشد و استفاده</h1>
        <p className="text-sm text-muted-foreground">
          ثبت‌نام‌ها، کاربرانی که واقعاً از پنل استفاده می‌کنند، مربی‌ها و باشگاه‌هایی که دیگر سر نمی‌زنند، و
          اینکه کدام بخش‌های پنل استفاده می‌شوند.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : isError || !data ? (
        <ErrorState message="دریافت آمار با خطا مواجه شد." />
      ) : (
        <>
          <Headline data={data} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <SignupsChart data={data} />
            <ActiveChart data={data} />
          </div>
          <InactiveCard data={data} days={inactiveDays} onDaysChange={setInactiveDays} />
          {data.subscriptions && <SubscriptionsCard subscriptions={data.subscriptions} />}
          <UsageCard data={data} />
        </>
      )}
    </div>
  );
}

function Headline({ data }: { data: AdminStats }) {
  const { totals, signups, active } = data;
  const weekTrend =
    signups.last_week === 0
      ? undefined
      : {
          direction: (signups.this_week > signups.last_week
            ? "up"
            : signups.this_week < signups.last_week
              ? "down"
              : "flat") as "up" | "down" | "flat",
          label: `هفتهٔ قبل ${formatNumber(signups.last_week)}`,
        };

  return (
    <StatisticsGrid>
      <StatisticCard
        icon={Users}
        title="همهٔ کاربران"
        value={formatNumber(totals.all)}
        footer={
          <p className="text-xs text-muted-foreground">
            {ROLES.map((role) => `${role.label} ${formatNumber(totals[role.key])}`).join(" · ")}
          </p>
        }
      />
      <StatisticCard
        icon={UserPlus}
        title="ثبت‌نام این هفته"
        value={formatNumber(signups.this_week)}
        trend={weekTrend}
        footer={<p className="text-xs text-muted-foreground">هفته از شنبه شروع می‌شود.</p>}
      />
      <StatisticCard
        icon={Activity}
        title="فعال امروز"
        value={formatNumber(active.today)}
        footer={<p className="text-xs text-muted-foreground">کسانی که امروز پنل را باز کرده‌اند.</p>}
      />
      <StatisticCard
        icon={CalendarClock}
        title="فعال ۷ روز / ۳۰ روز"
        value={`${formatNumber(active.week)} / ${formatNumber(active.month)}`}
        footer={
          <p className="text-xs text-muted-foreground">
            {totals.all > 0
              ? `${toPersianDigits(Math.round((active.month / totals.all) * 100))}٪ کاربران در ۳۰ روز اخیر سر زده‌اند.`
              : "هنوز کاربری نیست."}
          </p>
        }
      />
    </StatisticsGrid>
  );
}

function SignupsChart({ data }: { data: AdminStats }) {
  const daily = data.signups.daily.map((row) => ({ ...row, label: formatShortPersianDate(day(row.date)) }));
  const weekly = data.signups.weekly.map((row) => ({ ...row, label: weekLabel(row.start) }));
  const empty = data.signups.weekly.every((row) => row.club + row.trainer + row.athlete + row.none === 0);

  const chart = (rows: ({ label: string } & Record<(typeof ROLES)[number]["key"], number>)[]) => (
    <div className="h-72 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 0, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS_TICK} reversed minTickGap={8} />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={AXIS_TICK} orientation="right" />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} formatter={(v) => formatNumber(Number(v))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {ROLES.map((role) => (
            <Bar key={role.key} dataKey={role.key} name={role.label} stackId="roles" fill={role.color} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <Card className="py-5">
      <SectionHeader title="ثبت‌نام‌ها" />
      <div className="px-6">
        {empty ? (
          <EmptyState icon={UserPlus} title="در ۱۲ هفتهٔ اخیر ثبت‌نامی نبوده است." />
        ) : (
          <Tabs defaultValue="daily" className="space-y-3">
            <TabsList>
              <TabsTrigger value="daily">۳۰ روز اخیر</TabsTrigger>
              <TabsTrigger value="weekly">۱۲ هفتهٔ اخیر</TabsTrigger>
            </TabsList>
            <TabsContent value="daily">{chart(daily)}</TabsContent>
            <TabsContent value="weekly">{chart(weekly)}</TabsContent>
          </Tabs>
        )}
      </div>
    </Card>
  );
}

function ActiveChart({ data }: { data: AdminStats }) {
  const can = useAdminCan();
  const { active } = data;

  if (active.source !== "daily_active") {
    return (
      <Card className="py-5">
        <SectionHeader title="کاربران فعال" />
        <div className="space-y-3 px-6 text-sm text-muted-foreground">
          <p>
            نمودار روزانه و هفتگی کاربران فعال بعد از اجرای به‌روزرسانی دیتابیس «آمار رشد و نمایش پنل کاربر برای پشتیبانی (فاز ۹)»
            جمع‌آوری می‌شود. اعداد بالای صفحه تا آن موقع از آخرین بازدید هر کاربر حساب می‌شوند.
          </p>
          {can("super") && (
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/database">رفتن به به‌روزرسانی دیتابیس</Link>
            </Button>
          )}
        </div>
      </Card>
    );
  }

  const daily = active.daily.map((row) => ({ ...row, label: formatShortPersianDate(day(row.date)) }));
  const weekly = active.weekly.map((row) => ({ ...row, label: weekLabel(row.start) }));

  const chart = (rows: { label: string; count: number }[], name: string) => (
    <div className="h-72 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 0, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS_TICK} reversed minTickGap={8} />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={AXIS_TICK} orientation="right" />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [formatNumber(Number(v)), name]} />
          <Line type="monotone" dataKey="count" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <Card className="py-5">
      <SectionHeader title="کاربران فعال" />
      <div className="px-6">
        <Tabs defaultValue="daily" className="space-y-3">
          <TabsList>
            <TabsTrigger value="daily">روزانه</TabsTrigger>
            <TabsTrigger value="weekly">هفتگی</TabsTrigger>
          </TabsList>
          <TabsContent value="daily">{chart(daily, "فعال در این روز")}</TabsContent>
          <TabsContent value="weekly">{chart(weekly, "فعال در این هفته")}</TabsContent>
        </Tabs>
        <p className="mt-2 text-xs text-muted-foreground">
          هر کسی که در آن روز (یا هفته) پنل را باز کرده، یک بار شمرده می‌شود.
        </p>
      </div>
    </Card>
  );
}

function InactiveCard({
  data,
  days,
  onDaysChange,
}: {
  data: AdminStats;
  days: number;
  onDaysChange: (days: number) => void;
}) {
  const can = useAdminCan();
  const { trainers, clubs } = data.inactive;

  return (
    <Card className="py-5">
      <SectionHeader
        title="مربی‌ها و باشگاه‌هایی که دیگر سر نمی‌زنند"
        action={
          <Select value={String(days)} onValueChange={(value) => onDaysChange(Number(value))}>
            <SelectTrigger size="sm" aria-label="مدت غیبت">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INACTIVE_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  بیش از {toPersianDigits(option)} روز
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <div className="space-y-3 px-6">
        <p className="text-sm text-muted-foreground">
          کسانی که اخیراً غیبشان شروع شده اول آمده‌اند؛ برگرداندن آن‌ها از همه آسان‌تر است.
          {can("notifications") && (
            <>
              {" "}
              برای فرستادن پیام به همهٔ کاربران غیرفعال، در{" "}
              <Link href="/admin/notifications" className="text-primary underline underline-offset-4">
                اعلان همگانی
              </Link>{" "}
              گزینهٔ «فقط کسانی که مدتی وارد نشده‌اند» را روشن کنید.
            </>
          )}
        </p>
        <Tabs defaultValue="trainers" className="space-y-3">
          <TabsList>
            <TabsTrigger value="trainers">مربی‌ها ({formatNumber(trainers.count)})</TabsTrigger>
            <TabsTrigger value="clubs">باشگاه‌ها ({formatNumber(clubs.count)})</TabsTrigger>
          </TabsList>
          <TabsContent value="trainers">
            <InactiveTable kind="trainer" list={trainers} />
          </TabsContent>
          <TabsContent value="clubs">
            <InactiveTable kind="club" list={clubs} />
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
}

function InactiveTable({
  kind,
  list,
}: {
  kind: "trainer" | "club";
  list: { count: number; items: StatsInactiveUser[] };
}) {
  if (list.items.length === 0) {
    return (
      <EmptyState
        icon={UserX}
        title={kind === "trainer" ? "همهٔ مربی‌ها در این مدت سر زده‌اند." : "همهٔ باشگاه‌ها در این مدت سر زده‌اند."}
      />
    );
  }

  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{kind === "trainer" ? "مربی" : "باشگاه"}</TableHead>
            <TableHead>تماس</TableHead>
            <TableHead>آخرین بازدید</TableHead>
            <TableHead>{kind === "trainer" ? "شاگرد فعال" : "عضو از"}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.items.map((user) => {
            const name = fullName(user.first_name, user.last_name);
            const href =
              kind === "trainer"
                ? `/admin/trainers/detail?id=${user.id}`
                : user.club_id
                  ? `/admin/clubs/detail?id=${user.club_id}`
                  : null;
            return (
              <TableRow key={user.id}>
                <TableCell>
                  {href ? (
                    <Link href={href} className="font-medium text-foreground hover:underline">
                      {kind === "club" ? (user.club_name ?? name) : name}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">{name}</span>
                  )}
                  {kind === "club" && <p className="text-xs text-muted-foreground">{name}</p>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground" dir="ltr">
                  <div className="text-right">{user.phone ?? user.email ?? "—"}</div>
                </TableCell>
                <TableCell className="text-sm">{formatRelativeTime(new Date(user.last_seen_at.replace(" ", "T")))}</TableCell>
                <TableCell className="text-sm">
                  {kind === "trainer"
                    ? formatNumber(user.athletes ?? 0)
                    : formatPersianDate(new Date(user.created_at.replace(" ", "T")))}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {list.count > list.items.length && (
        <p className="text-xs text-muted-foreground">
          {formatNumber(list.items.length)} مورد از {formatNumber(list.count)} مورد نشان داده شده است.
        </p>
      )}
    </div>
  );
}

function SubscriptionsCard({ subscriptions }: { subscriptions: NonNullable<AdminStats["subscriptions"]> }) {
  const rows = (items: StatsSubscription[], expired: boolean) =>
    items.length === 0 ? (
      <EmptyState
        icon={CalendarClock}
        title={expired ? "در ۳۰ روز اخیر اشتراکی بدون تمدید تمام نشده است." : "اشتراکی رو به اتمام نیست."}
      />
    ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>باشگاه</TableHead>
            <TableHead>پلن</TableHead>
            <TableHead>{expired ? "تمام شده در" : "تمام می‌شود"}</TableHead>
            <TableHead>مدیر باشگاه</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((row) => (
            <TableRow key={row.club_id}>
              <TableCell>
                <Link href={`/admin/clubs/detail?id=${row.club_id}`} className="font-medium text-foreground hover:underline">
                  {row.club_name}
                </Link>
              </TableCell>
              <TableCell className="text-sm">{row.plan_name}</TableCell>
              <TableCell className="text-sm">
                {formatPersianDate(new Date(row.expires_at.replace(" ", "T")))}
                {!expired && (
                  <Badge variant="warning" className="ms-2">
                    {toPersianDigits(row.days_left)} روز مانده
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {row.owner_name || "—"}
                {row.owner_phone && (
                  <span className="block text-xs text-muted-foreground" dir="ltr">
                    {row.owner_phone}
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );

  return (
    <Card className="py-5">
      <SectionHeader
        title="اشتراک‌های رو به اتمام"
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/subscriptions">همهٔ اشتراک‌ها</Link>
          </Button>
        }
      />
      <div className="px-6">
        <Tabs defaultValue="expiring" className="space-y-3">
          <TabsList className="h-auto flex-wrap justify-start rounded-2xl">
            <TabsTrigger value="expiring">
              تا {toPersianDigits(subscriptions.expiring_days)} روز آینده ({formatNumber(subscriptions.expiring.length)})
            </TabsTrigger>
            <TabsTrigger value="expired">
              تمام‌شده و تمدیدنشده ({formatNumber(subscriptions.expired.length)})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="expiring">{rows(subscriptions.expiring, false)}</TabsContent>
          <TabsContent value="expired">{rows(subscriptions.expired, true)}</TabsContent>
        </Tabs>
      </div>
    </Card>
  );
}

function UsageCard({ data }: { data: AdminStats }) {
  const can = useAdminCan();
  const max = Math.max(1, ...data.usage.map((row) => row.actors));

  return (
    <Card className="py-5">
      <SectionHeader title="استفاده از بخش‌های پنل (۳۰ روز اخیر)" />
      <div className="space-y-3 px-6">
        <p className="text-sm text-muted-foreground">
          «افراد» یعنی چند نفر در ۳۰ روز اخیر در آن بخش چیزی ثبت کرده‌اند و «ثبت‌ها» تعداد کل آن ثبت‌ها. تغییر،
          مقایسه با ۳۰ روز قبل از آن است.
          {can("settings") && (
            <>
              {" "}
              بخشی که کسی از آن استفاده نمی‌کند را می‌توانید از{" "}
              <Link href="/admin/features" className="text-primary underline underline-offset-4">
                مدیریت بخش‌ها
              </Link>{" "}
              خاموش کنید.
            </>
          )}
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>بخش</TableHead>
              <TableHead className="w-2/5">افراد</TableHead>
              <TableHead>ثبت‌ها</TableHead>
              <TableHead>تغییر افراد</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.usage.map((row) => (
              <TableRow key={row.key}>
                <TableCell>
                  <span className="font-medium text-foreground">{row.label}</span>
                  {!row.enabled && (
                    <Badge variant="outline" className="ms-2">
                      خاموش برای بعضی
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(row.actors / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-sm tabular-nums">{formatNumber(row.actors)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm tabular-nums">{formatNumber(row.actions)}</TableCell>
                <TableCell>{changeBadge(row.actors, row.prev_actors)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
