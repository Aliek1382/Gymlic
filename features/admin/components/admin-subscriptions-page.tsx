"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Gift, Loader2, Search, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber, formatPersianDate, parseLocaleNumber, toAsciiDigits } from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import type { AdminClubRow } from "../services/admin-service";
import { giftAllSubscriptions, listSubscriptions } from "../services/admin-billing-service";
import { ExportButton } from "./export-button";
import { SubscriptionDialog } from "./subscription-dialog";
import { SubscriptionStatusBadge } from "./subscription-status-badge";

const QUERY_KEY = ["admin", "subscriptions"] as const;

type Filter = "all" | "active" | "expiring" | "expired" | "none";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "همه" },
  { value: "expiring", label: "رو به اتمام" },
  { value: "expired", label: "منقضی" },
  { value: "active", label: "فعال" },
  { value: "none", label: "بدون اشتراک" },
];

/** Running-out first, then expired, then the rest by expiry. */
const ORDER: Record<string, number> = { expiring: 0, expired: 1, active: 2, none: 3 };

export function AdminSubscriptionsPage() {
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
    const c: Record<Filter, number> = { all: 0, active: 0, expiring: 0, expired: 0, none: 0 };
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

function GiftAllDialog({
  open,
  onClose,
  running,
  withSubscription,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  running: number;
  withSubscription: number;
  onDone: () => void;
}) {
  const [days, setDays] = useState("1");
  const [includeExpired, setIncludeExpired] = useState(false);
  const [notify, setNotify] = useState(true);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const value = parseLocaleNumber(days);
    if (value === null || !Number.isInteger(value) || value < 1 || value > 3650) {
      toast.error("تعداد روز باید بین ۱ و ۳۶۵۰ باشد.");
      return;
    }
    setSaving(true);
    try {
      const count = await giftAllSubscriptions({ days: value, includeExpired, notify, note: note.trim() });
      toast.success(`${formatNumber(value)} روز به اشتراک ${formatNumber(count)} باشگاه اضافه شد.`);
      onDone();
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, "افزودن روز هدیه ناموفق بود."));
    } finally {
      setSaving(false);
    }
  }

  const target = includeExpired ? withSubscription : running;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>روز هدیه به همه</DialogTitle>
          <DialogDescription>
            مثلاً برای جبران روزهایی که سایت در دسترس نبود. روزها به انتهای اشتراک هر باشگاه اضافه
            می‌شوند.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gift-all-days">تعداد روز</Label>
            <Input id="gift-all-days" dir="ltr" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <Switch checked={includeExpired} onCheckedChange={setIncludeExpired} className="mt-0.5" />
            <span>
              اشتراک‌های منقضی را هم شامل شود
              <span className="block text-xs text-muted-foreground">
                خاموش: فقط اشتراک‌هایی که هنوز تمام نشده‌اند. روشن: منقضی‌ها از امروز دوباره فعال می‌شوند.
              </span>
            </span>
          </label>
          <div className="space-y-2">
            <Label htmlFor="gift-all-note">
              توضیح <span className="text-muted-foreground">(اختیاری، در متن اعلان)</span>
            </Label>
            <Input
              id="gift-all-note"
              value={note}
              maxLength={500}
              placeholder="مثلاً: بابت قطعی دیروز سایت"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <Switch checked={notify} onCheckedChange={setNotify} />
            به مالک هر باشگاه اعلان بده
          </label>
          <p className="text-sm text-foreground">
            شامل {formatNumber(target)} باشگاه می‌شود.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving || target === 0}>
            {saving && <Loader2 className="animate-spin" />}
            افزودن روز هدیه
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
