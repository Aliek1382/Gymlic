"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings2, SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatPersianDate } from "@/lib/persian";
import { TrainerRequestsTable } from "@/features/trainer-billing/components/trainer-payment-requests";
import { listTrainerRequests } from "@/features/trainer-billing/services/trainer-billing-service";
import { useAdminCan } from "../hooks/use-admin-access";
import { getAccountAccess, getPlanAccount, type PlanAccount } from "../services/plan-accounts-service";
import { AccountAccessDialog } from "./account-access-dialog";
import { PlanAccountDialog } from "./plan-account-dialog";
import { SubscriptionStatusBadge } from "./subscription-status-badge";

const parseDate = (value: string) => new Date(value.replace(" ", "T"));

/**
 * On a trainer's admin page: their plan (with the plan dialog and their
 * access set by hand) for finance.plans, and their payments to the platform
 * with the receipts for finance.payments.
 */
export function TrainerFinanceSection({ trainerId, name }: { trainerId: string; name: string }) {
  const can = useAdminCan();
  return (
    <>
      {can("finance.plans") && <PlanCard kind="trainer" id={trainerId} name={name} />}
      {can("finance.payments") && <TrainerPaymentsCard trainerId={trainerId} />}
    </>
  );
}

/**
 * The account's plan in short, and the two ways to change what they get:
 * the plan itself (dates, extension, caps) and access set by hand.
 * accessOnly: just the latter (a club's page has its own subscription card).
 */
export function PlanCard({
  kind,
  id,
  name,
  accessOnly = false,
}: {
  kind: PlanAccount["kind"];
  id: string;
  name: string;
  accessOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  const account = useQuery({
    queryKey: ["admin", "plan-account", kind, id],
    queryFn: () => getPlanAccount(kind, id),
    retry: false,
    enabled: !accessOnly,
  });
  const access = useQuery({ queryKey: ["admin", "account-access", kind, id], queryFn: () => getAccountAccess(kind, id) });
  const [managing, setManaging] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);

  const custom = access.data?.access;
  const customCount = custom
    ? (custom.tier ? 1 : 0) + Object.keys(custom.features).length + Object.keys(custom.limits).length
    : 0;
  const tierLabel = (key: string | null | undefined) =>
    key && access.data ? access.data.tier_labels[key as keyof typeof access.data.tier_labels] : null;

  return (
    <Card className="gap-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6">
        <CardTitle className="text-base">{accessOnly ? "دسترسی اختصاصی" : "اشتراک و دسترسی"}</CardTitle>
        <div className="flex flex-wrap gap-2">
          {account.data && (
            <Button size="sm" variant="outline" onClick={() => setManaging(true)}>
              <Settings2 />
              مدیریت اشتراک
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setAccessOpen(true)}>
            <SlidersHorizontal />
            دسترسی اختصاصی
            {customCount > 0 && <Badge variant="secondary">{formatNumber(customCount)}</Badge>}
          </Button>
        </div>
      </div>

      {accessOnly ? (
        <p className="px-6 text-sm text-muted-foreground">
          سطح ثابت و باز یا بستن تک‌تک بخش‌ها برای این حساب، مستقل از پلن.
        </p>
      ) : account.isLoading ? (
        <Skeleton className="mx-6 h-16" />
      ) : !account.data ? (
        <p className="px-6 text-sm text-muted-foreground">
          جزئیات پلن بعد از به‌روزرسانی «پلن‌ها و محدودیت مربی و باشگاه» نمایش داده می‌شود.
        </p>
      ) : (
        <AccountSummary account={account.data.account} />
      )}

      {access.data?.ready && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-6 pt-3 text-xs text-muted-foreground">
          <span>
            سطح پلن:{" "}
            <span className="font-medium text-foreground">
              {tierLabel(custom?.tier) ?? tierLabel(access.data.plan_tier) ?? "بدون سطح"}
            </span>
            {custom?.tier && " (ثابت، اختصاصی)"}
          </span>
          {custom && Object.keys(custom.features).length > 0 && (
            <span>
              · بخش‌های اختصاصی:{" "}
              {access.data.catalog
                .filter((entry) => entry.key in custom.features)
                .map((entry) => `${entry.label} ${custom.features[entry.key as keyof typeof custom.features] ? "(باز)" : "(بسته)"}`)
                .join("، ")}
            </span>
          )}
          {custom && Object.keys(custom.limits).length > 0 && <span>· سقف اختصاصی دارد</span>}
          {custom?.note && <span>· یادداشت: {custom.note}</span>}
        </div>
      )}

      {account.data && (
        <PlanAccountDialog
          account={managing ? account.data.account : null}
          plans={account.data.plans ?? []}
          onClose={() => setManaging(false)}
          onSaved={() => void queryClient.invalidateQueries({ queryKey: ["admin"] })}
        />
      )}
      <AccountAccessDialog kind={kind} id={id} name={name} open={accessOpen} onClose={() => setAccessOpen(false)} />
    </Card>
  );
}

function AccountSummary({ account }: { account: PlanAccount }) {
  if (account.kind === "trainer") {
    const limits = account.limits;
    const subscription = limits.subscription;
    const paid = subscription && !subscription.is_free;
    return (
      <div className="grid grid-cols-2 gap-4 px-6 text-sm sm:grid-cols-4">
        <Fact label="پلن">
          {limits.plan.name ?? "—"}
          {limits.club && <span className="block text-xs text-muted-foreground">عضو باشگاه {limits.club.name}</span>}
        </Fact>
        <Fact label="وضعیت">{paid ? <SubscriptionStatusBadge status={limits.status} /> : <Badge variant="secondary">پلن رایگان</Badge>}</Fact>
        <Fact label="پایان">
          {paid && subscription.expires_at ? formatPersianDate(parseDate(subscription.expires_at)) : "—"}
          {paid && subscription.remaining_days != null && subscription.remaining_days > 0 && (
            <span className="block text-xs text-muted-foreground">{formatNumber(subscription.remaining_days)} روز مانده</span>
          )}
        </Fact>
        <Fact label="شاگردان">
          {formatNumber(limits.usage.active)}
          {limits.max_athletes != null && ` از ${formatNumber(limits.max_athletes)}`}
          {limits.override && <span className="block text-xs text-muted-foreground">سقف دستی</span>}
        </Fact>
      </div>
    );
  }
  const limits = account.limits;
  return (
    <div className="grid grid-cols-2 gap-4 px-6 text-sm sm:grid-cols-4">
      <Fact label="پلن">{limits.plan_name ?? "—"}</Fact>
      <Fact label="وضعیت">
        <SubscriptionStatusBadge status={limits.status} />
      </Fact>
      <Fact label="پایان">{limits.expires_at ? formatPersianDate(parseDate(limits.expires_at)) : "—"}</Fact>
      <Fact label="اعضا">
        {formatNumber(limits.usage.members)}
        {limits.max_members != null && ` از ${formatNumber(limits.max_members)}`}
      </Fact>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-foreground">{children}</div>
    </div>
  );
}

/** The trainer's payments to the platform, receipts included; the pending ones can be reviewed here. */
function TrainerPaymentsCard({ trainerId }: { trainerId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "trainer-requests", trainerId],
    queryFn: () => listTrainerRequests(trainerId),
  });
  const rows = data?.items ?? [];
  const pending = rows.filter((row) => row.status === "pending");
  const reviewed = rows.filter((row) => row.status !== "pending");

  return (
    <Card className="gap-4 py-5">
      <div className="px-6">
        <CardTitle className="text-base">پرداخت‌ها و رسیدها</CardTitle>
      </div>
      {isLoading ? (
        <Skeleton className="mx-6 h-16" />
      ) : data && !data.ready ? (
        <p className="px-6 text-sm text-muted-foreground">اشتراک مربی هنوز فعال نشده است.</p>
      ) : rows.length === 0 ? (
        <p className="px-6 text-sm text-muted-foreground">این مربی هنوز پرداختی ثبت نکرده است.</p>
      ) : (
        <>
          {pending.length > 0 && <TrainerRequestsTable rows={pending} showActions showTrainer={false} />}
          {reviewed.length > 0 && <TrainerRequestsTable rows={reviewed} showActions={false} showTrainer={false} />}
        </>
      )}
    </Card>
  );
}
