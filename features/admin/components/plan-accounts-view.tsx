"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Gift, Search, Settings2, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { formatNumber, formatPersianDate, toAsciiDigits } from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import type { PlanAccount, PlanAccountsData } from "../services/plan-accounts-service";
import { GiftAllDialog } from "./gift-all-dialog";
import { ExportButton } from "./export-button";
import { PlanAccountDialog } from "./plan-account-dialog";
import { SubscriptionStatusBadge } from "./subscription-status-badge";

type Kind = "trainer" | "club";
type StatusFilter = "all" | "active" | "expiring" | "grace" | "expired" | "free";

const STATUS_FILTERS: { value: StatusFilter; label: string; kinds: Kind[] }[] = [
  { value: "all", label: "همه", kinds: ["trainer", "club"] },
  { value: "active", label: "فعال", kinds: ["trainer", "club"] },
  { value: "expiring", label: "رو به اتمام", kinds: ["trainer", "club"] },
  { value: "grace", label: "در مهلت", kinds: ["trainer", "club"] },
  { value: "expired", label: "منقضی", kinds: ["trainer", "club"] },
  { value: "free", label: "رایگان / بدون اشتراک", kinds: ["trainer", "club"] },
];

const ORDER: Record<StatusFilter, number> = { grace: 0, expiring: 1, expired: 2, active: 3, free: 4, all: 5 };

const parseDate = (value: string) => new Date(value.replace(" ", "T"));
const showDate = (value: string | null | undefined) => (value ? formatPersianDate(parseDate(value)) : "—");
const showCap = (value: number | null) => (value == null ? "∞" : formatNumber(value));

/** The filter an account falls under: a paid plan's state, or free / never subscribed. */
function statusOf(account: PlanAccount): StatusFilter {
  if (account.kind === "trainer") {
    const l = account.limits;
    if (l.plan.is_free && l.status !== "expired") return "free";
    return l.status ?? "free";
  }
  return account.limits.status ?? "free";
}

function planOf(account: PlanAccount): string {
  return (account.kind === "trainer" ? account.limits.plan.name : account.limits.plan_name) ?? "—";
}

function overCap(account: PlanAccount): boolean {
  return account.limits.over_cap;
}

function expiryOf(account: PlanAccount): string | null {
  if (account.kind === "trainer") {
    const s = account.limits.subscription;
    return s && !s.is_free ? s.expires_at : null;
  }
  return account.limits.expires_at;
}

/** Every trainer's and club's plan: filter, search, export, and change one by hand. */
export function PlanAccountsView({ data }: { data: PlanAccountsData }) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<Kind>("trainer");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [plan, setPlan] = useState("all");
  const [onlyOver, setOnlyOver] = useState(false);
  const [onlyOverride, setOnlyOverride] = useState(false);
  const [search, setSearch] = useState("");
  const [managing, setManaging] = useState<PlanAccount | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);

  const accounts: PlanAccount[] = useMemo(
    () => (kind === "trainer" ? data.trainers : data.clubs),
    [data, kind]
  );
  const plans = (kind === "trainer" ? data.trainer_plans : data.club_plans) ?? [];
  const planNames = useMemo(() => [...new Set(accounts.map(planOf))].sort(), [accounts]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: 0, active: 0, expiring: 0, grace: 0, expired: 0, free: 0 };
    for (const account of accounts) {
      c.all++;
      c[statusOf(account)]++;
    }
    return c;
  }, [accounts]);

  const rows = useMemo(() => {
    const term = toAsciiDigits(search.trim()).toLowerCase();
    return accounts
      .filter((a) => status === "all" || statusOf(a) === status)
      .filter((a) => plan === "all" || planOf(a) === plan)
      .filter((a) => !onlyOver || overCap(a))
      .filter((a) => !onlyOverride || a.limits.override)
      .filter((a) => {
        if (!term) return true;
        const extra = a.kind === "trainer" ? [a.email, a.club_name] : [a.owner_name];
        return [a.name, a.phone, planOf(a), ...extra]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => {
        const byStatus = ORDER[statusOf(a)] - ORDER[statusOf(b)];
        if (byStatus !== 0) return byStatus;
        return (expiryOf(a) ?? "9999").localeCompare(expiryOf(b) ?? "9999");
      });
  }, [accounts, status, plan, onlyOver, onlyOverride, search]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "plan-accounts"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "plan-account"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "clubs"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">اشتراک‌ها و پلن‌ها</h1>
          <p className="text-sm text-muted-foreground">
            پلن، وضعیت، تاریخ‌ها و مصرف هر مربی و باشگاه؛ فعال‌سازی و تغییر دستی پلن، تاریخ‌ها و سقف.
            «رو به اتمام» از {formatNumber(data.expiring_days ?? 7)} روز مانده و مهلت پس از انقضا{" "}
            {formatNumber(data.grace_days ?? 7)} روز است (
            <Link href="/admin/billing" className="underline">
              اطلاعات پرداخت
            </Link>
            ).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {kind === "club" && (
            <Button variant="outline" onClick={() => setGiftOpen(true)}>
              <Gift />
              روز هدیه به همه
            </Button>
          )}
          <ExportButton kind={kind === "trainer" ? "trainer-subscriptions" : "subscriptions"} />
        </div>
      </div>

      {!data.enforcing && (
        <div className="flex gap-3 rounded-2xl border border-warning/30 bg-warning-muted p-4 text-sm text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" />
          محدودیت پلن‌ها هنوز اعمال نمی‌شود؛ سقف‌ها فقط نمایش داده می‌شوند. روشن‌کردن در «اطلاعات پرداخت ← اعمال
          محدودیت پلن‌ها».
        </div>
      )}

      <Tabs
        value={kind}
        onValueChange={(value) => {
          setKind(value as Kind);
          setPlan("all");
        }}
      >
        <TabsList>
          <TabsTrigger value="trainer">مربی‌ها ({formatNumber(data.trainers.length)})</TabsTrigger>
          <TabsTrigger value="club">باشگاه‌ها ({formatNumber(data.clubs.length)})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="gap-4 py-5">
        <div className="flex flex-col gap-3 px-6">
          <Tabs value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
            <TabsList className="h-auto flex-wrap justify-start rounded-2xl">
              {STATUS_FILTERS.filter((f) => f.kinds.includes(kind)).map((f) => (
                <TabsTrigger key={f.value} value={f.value}>
                  {f.value === "free" && kind === "club" ? "بدون اشتراک" : f.label} ({formatNumber(counts[f.value])})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative lg:w-72">
              <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={kind === "trainer" ? "جست‌وجوی نام، موبایل یا ایمیل" : "جست‌وجوی باشگاه، مالک یا موبایل"}
                className="pr-9"
              />
            </div>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger className="lg:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همهٔ پلن‌ها</SelectItem>
                {planNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Switch checked={onlyOver} onCheckedChange={setOnlyOver} />
              فقط بالای سقف
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Switch checked={onlyOverride} onCheckedChange={setOnlyOverride} />
              فقط سقف دستی
            </label>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="px-6">
            <EmptyState icon={CalendarClock} title="موردی با این شرایط نیست." description="فیلتر یا جست‌وجو را تغییر دهید." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{kind === "trainer" ? "مربی" : "باشگاه"}</TableHead>
                <TableHead>پلن</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead>شروع</TableHead>
                <TableHead>پایان</TableHead>
                <TableHead>مصرف</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((account) => (
                <AccountRow key={account.id} account={account} onManage={() => setManaging(account)} />
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <PlanAccountDialog account={managing} plans={plans} onClose={() => setManaging(null)} onSaved={refresh} />
      <GiftAllDialog
        open={giftOpen}
        onClose={() => setGiftOpen(false)}
        running={data.clubs.filter((c) => c.limits.status === "active" || c.limits.status === "expiring").length}
        withSubscription={data.clubs.filter((c) => c.limits.status !== null).length}
        onDone={refresh}
      />
    </div>
  );
}

function AccountRow({ account, onManage }: { account: PlanAccount; onManage: () => void }) {
  const isTrainer = account.kind === "trainer";
  const href = isTrainer ? `/admin/trainers/detail?id=${account.id}` : `/admin/clubs/detail?id=${account.id}`;
  const start = isTrainer
    ? account.limits.subscription && !account.limits.subscription.is_free
      ? account.limits.subscription.started_at
      : null
    : account.limits.started_at;
  const end = expiryOf(account);
  const graceEnd = isTrainer ? account.limits.subscription?.grace_ends_at : account.limits.grace_ends_at;
  const remaining = isTrainer ? account.limits.subscription?.remaining_days : account.limits.remaining_days;

  return (
    <TableRow>
      <TableCell>
        <Link href={href} className="font-medium text-foreground hover:underline">
          {account.name || "بی‌نام"}
        </Link>
        <p className="text-xs text-muted-foreground">
          {!isTrainer && account.owner_name && `${account.owner_name} · `}
          {account.phone ? <span dir="ltr">{account.phone}</span> : "—"}
          {isTrainer && account.club_name && ` · باشگاه ${account.club_name}`}
        </p>
      </TableCell>
      <TableCell className="text-muted-foreground">
        <div className="flex flex-wrap items-center gap-1">
          {planOf(account)}
          {account.limits.override && <Badge variant="info">سقف دستی</Badge>}
        </div>
      </TableCell>
      <TableCell>
        {isTrainer && account.limits.plan.is_free && account.limits.status !== "expired" ? (
          <Badge variant="secondary">رایگان</Badge>
        ) : (
          <SubscriptionStatusBadge status={account.limits.status} />
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{showDate(start)}</TableCell>
      <TableCell className="text-muted-foreground">
        {showDate(end)}
        {end && remaining != null && remaining > 0 && <p className="text-xs">{formatNumber(remaining)} روز مانده</p>}
        {end && account.limits.status === "grace" && <p className="text-xs text-warning">مهلت تا {showDate(graceEnd)}</p>}
      </TableCell>
      <TableCell className={account.limits.over_cap ? "text-destructive" : "text-muted-foreground"}>
        {isTrainer ? (
          <>
            {formatNumber(account.limits.usage.active + account.limits.usage.pending_invites)} / {showCap(account.limits.max_athletes)} ورزشکار
            {account.limits.usage.suspended > 0 && (
              <p className="text-xs text-warning">{formatNumber(account.limits.usage.suspended)} غیرفعال</p>
            )}
            {account.limits.content && (
              <p className="text-xs">
                {account.limits.content.via_club ? (
                  <>
                    {formatNumber(account.limits.content.exercises.used)} حرکت ·{" "}
                    {formatNumber(account.limits.content.templates.used)} قالب (باشگاه)
                  </>
                ) : (
                  <>
                    <span className={account.limits.content.exercises.over ? "text-destructive" : undefined}>
                      {formatNumber(account.limits.content.exercises.used)} / {showCap(account.limits.content.exercises.max)} حرکت
                    </span>
                    {" · "}
                    <span className={account.limits.content.templates.over ? "text-destructive" : undefined}>
                      {formatNumber(account.limits.content.templates.used)} / {showCap(account.limits.content.templates.max)} قالب
                    </span>
                  </>
                )}
              </p>
            )}
          </>
        ) : (
          <>
            <p>
              {formatNumber(account.limits.usage.members)} / {showCap(account.limits.max_members)} عضو
            </p>
            <p className="text-xs">
              {formatNumber(account.limits.usage.trainers)} / {showCap(account.limits.max_trainers)} مربی
            </p>
          </>
        )}
      </TableCell>
      <TableCell>
        <Button size="sm" variant="outline" onClick={onManage}>
          <Settings2 />
          مدیریت
        </Button>
      </TableCell>
    </TableRow>
  );
}
