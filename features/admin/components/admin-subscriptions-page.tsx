"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Gift, Search, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber, formatPersianDate, toAsciiDigits } from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import type { AdminClubRow } from "../services/admin-service";
import { listSubscriptions } from "../services/admin-billing-service";
import { listPlanAccounts } from "../services/plan-accounts-service";
import { ExportButton } from "./export-button";
import { GiftAllDialog } from "./gift-all-dialog";
import { PlanAccountsView } from "./plan-accounts-view";
import { SubscriptionDialog } from "./subscription-dialog";
import { SubscriptionStatusBadge } from "./subscription-status-badge";

const QUERY_KEY = ["admin", "subscriptions"] as const;

type Filter = "all" | "active" | "expiring" | "grace" | "expired" | "none";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "همه" },
  { value: "expiring", label: "رو به اتمام" },
  { value: "grace", label: "در مهلت" },
  { value: "expired", label: "منقضی" },
  { value: "active", label: "فعال" },
  { value: "none", label: "بدون اشتراک" },
];

/** Running-out first, then expired, then the rest by expiry. */
const ORDER: Record<string, number> = { expiring: 0, grace: 1, expired: 2, active: 3, none: 4 };

/**
 * Trainers' and clubs' plans in one place once the plan-limits database
 * update has run; until then, the clubs' subscriptions as before.
 */
export function AdminSubscriptionsPage() {
  const accounts = useQuery({ queryKey: ["admin", "plan-accounts"], queryFn: listPlanAccounts });
  if (accounts.isLoading) return <Skeleton className="h-64 rounded-2xl" />;
  if (accounts.data?.ready) return <PlanAccountsView data={accounts.data} />;
  return <ClubSubscriptionsPage />;
}

function ClubSubscriptionsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: QUERY_KEY, queryFn: listSubscriptions });
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [managing, setManaging] = useState<AdminClubRow | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ["admin", "clubs"] });
  };

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, active: 0, expiring: 0, grace: 0, expired: 0, none: 0 };
    for (const club of data?.items ?? []) {
      c.all++;
      c[club.subscription_status ?? "none"]++;
    }
    return c;
  }, [data]);

  const rows = useMemo(() => {
    const term = toAsciiDigits(search.trim()).toLowerCase();
    return (data?.items ?? [])
      .filter((club) => filter === "all" || (club.subscription_status ?? "none") === filter)
      .filter((club) => {
        if (!term) return true;
        const owner = `${club.owner_first_name ?? ""} ${club.owner_last_name ?? ""}`;
        return [club.name, owner, club.owner_phone, club.owner_email, club.plan_name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => {
        const byStatus = ORDER[a.subscription_status ?? "none"] - ORDER[b.subscription_status ?? "none"];
        if (byStatus !== 0) return byStatus;
        return (a.subscription_expires_at ?? "").localeCompare(b.subscription_expires_at ?? "");
      });
  }, [data, filter, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">اشتراک باشگاه‌ها</h1>
          <p className="text-sm text-muted-foreground">
            تمدید دستی، روز هدیه و تنظیم تاریخ انقضا و ظرفیت هر باشگاه. وضعیت «رو به اتمام» از
            «اطلاعات پرداخت» تنظیم می‌شود.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setGiftOpen(true)} disabled={!data}>
            <Gift />
            روز هدیه به همه
          </Button>
          <ExportButton kind="subscriptions" />
        </div>
      </div>

      <Card className="gap-4 py-5">
        <div className="flex flex-col gap-3 px-6 lg:flex-row lg:items-center lg:justify-between">
          <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
            <TabsList className="h-auto flex-wrap justify-start rounded-2xl">
              {FILTERS.map((f) => (
                <TabsTrigger key={f.value} value={f.value}>
                  {f.label} ({formatNumber(counts[f.value])})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative lg:w-72">
            <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جست‌وجوی باشگاه، مالک یا موبایل"
              className="pr-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="px-6">
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        ) : isError || !data ? (
          <div className="px-6">
            <ErrorState message="دریافت اشتراک‌ها با خطا مواجه شد." />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6">
            <EmptyState icon={CalendarClock} title="باشگاهی با این شرایط نیست." description="فیلتر یا جست‌وجو را تغییر دهید." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>باشگاه</TableHead>
                <TableHead>پلن</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead>انقضا</TableHead>
                <TableHead>اعضا / ظرفیت</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((club) => (
                <TableRow key={club.id}>
                  <TableCell>
                    <Link href={`/admin/clubs/detail?id=${club.id}`} className="font-medium text-foreground hover:underline">
                      {club.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {[club.owner_first_name, club.owner_last_name].filter(Boolean).join(" ") || "—"}
                      {club.owner_phone && (
                        <>
                          {" · "}
                          <span dir="ltr">{club.owner_phone}</span>
                        </>
                      )}
                    </p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{club.plan_name ?? "—"}</TableCell>
                  <TableCell>
                    <SubscriptionStatusBadge status={club.subscription_status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {club.subscription_expires_at ? (
                      <>
                        {formatPersianDate(new Date(club.subscription_expires_at))}
                        {club.subscription_remaining_days != null && club.subscription_remaining_days > 0 && (
                          <p className="text-xs">{formatNumber(club.subscription_remaining_days)} روز مانده</p>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatNumber(club.member_count)} /{" "}
                    {club.member_capacity != null ? formatNumber(club.member_capacity) : "∞"}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setManaging(club)}>
                      <Settings2 />
                      مدیریت
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <SubscriptionDialog
        club={managing}
        plans={data?.plans ?? []}
        onClose={() => setManaging(null)}
        onSaved={refresh}
      />
      <GiftAllDialog
        open={giftOpen}
        onClose={() => setGiftOpen(false)}
        running={counts.active + counts.expiring}
        withSubscription={counts.all - counts.none}
        onDone={refresh}
      />
    </div>
  );
}
