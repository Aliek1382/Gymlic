"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, Loader2, Mail, MessageSquareText, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fullName } from "@/lib/api/client";
import { formatNumber, formatRelativeTime } from "@/lib/persian";
import { getErrorMessage } from "@/lib/get-error-message";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import {
  listDeliveries,
  retryAllFailedDeliveries,
  retryDelivery,
  sendDeliveryNow,
  type DeliveryChannel,
  type DeliveryRow,
  type DeliveryStatus,
} from "../services/admin-system-service";
import { parseSqlDate } from "../utils/format";

const STATUS_FILTERS: { value: DeliveryStatus | ""; label: string }[] = [
  { value: "", label: "همه" },
  { value: "failed", label: "ناموفق" },
  { value: "pending", label: "در صف" },
  { value: "sent", label: "ارسال‌شده" },
];

const CHANNEL_FILTERS: { value: DeliveryChannel | ""; label: string }[] = [
  { value: "", label: "پیامک و ایمیل" },
  { value: "sms", label: "پیامک" },
  { value: "email", label: "ایمیل" },
];

const STATUS_BADGE: Record<DeliveryStatus, { label: string; variant: "success" | "destructive" | "warning" }> = {
  sent: { label: "ارسال شد", variant: "success" },
  failed: { label: "ناموفق", variant: "destructive" },
  pending: { label: "در صف", variant: "warning" },
};

function FilterChips<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <button
          key={item.value || "all"}
          type="button"
          data-active={value === item.value}
          onClick={() => onChange(item.value)}
          className="rounded-full border border-border px-3 py-1 text-xs transition-colors hover:bg-muted data-[active=true]:border-primary data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function AdminDeliveriesPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<DeliveryStatus | "">("failed");
  const [channel, setChannel] = useState<DeliveryChannel | "">("");
  const [confirmAll, setConfirmAll] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "deliveries", status, channel],
    queryFn: () => listDeliveries(status, channel),
    placeholderData: (previous) => previous,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin", "deliveries"] });

  const stats = data?.stats ?? [];
  const failedTotal = stats.reduce((sum, row) => sum + row.failed, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">صف پیامک و ایمیل</h1>
          <p className="text-sm text-muted-foreground">
            نسخه‌های پیامکی و ایمیلی اعلان‌ها، برای کاربرانی که آن را در تنظیماتشان روشن کرده‌اند. هر
            مورد ناموفق تا {formatNumber(data?.max_attempts ?? 3)} بار خودکار دوباره امتحان می‌شود؛
            بعد از آن این‌جا می‌ماند تا خودتان دوباره بفرستید.
          </p>
        </div>
        {failedTotal > 0 && (
          <Button variant="outline" onClick={() => setConfirmAll(true)}>
            <RotateCcw />
            ارسال دوبارهٔ همهٔ ناموفق‌ها
          </Button>
        )}
      </div>

      {data && !data.ready ? (
        <Card className="py-8">
          <div className="px-6">
            <EmptyState
              icon={Inbox}
              title="صف ارسال هنوز ساخته نشده است."
              description="به‌روزرسانی «ارسال اعلان‌ها با پیامک و ایمیل» را از صفحهٔ «به‌روزرسانی دیتابیس» اجرا کنید."
            />
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(["sms", "email"] as const).map((ch) => {
              const row = stats.find((s) => s.channel === ch);
              const Icon = ch === "sms" ? MessageSquareText : Mail;
              return (
                <Card key={ch} className="gap-2 py-4">
                  <div className="flex items-center gap-2 px-5">
                    <Icon className="size-4 text-muted-foreground" />
                    <CardTitle className="text-sm">
                      {ch === "sms" ? "پیامک" : "ایمیل"} — ۳۰ روز گذشته
                    </CardTitle>
                  </div>
                  <div className="grid grid-cols-4 gap-2 px-5 text-center">
                    {[
                      { label: "ارسال‌شده", value: row?.sent ?? 0, className: "text-success" },
                      { label: "ناموفق", value: row?.failed ?? 0, className: "text-destructive" },
                      { label: "در صف", value: row?.pending ?? 0, className: "text-warning" },
                      { label: "این ماه", value: row?.sent_this_month ?? 0, className: "text-foreground" },
                    ].map((item) => (
                      <div key={item.label}>
                        <p className={`text-lg font-bold ${item.className}`}>{formatNumber(item.value)}</p>
                        <p className="text-[11px] text-muted-foreground">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>

          <Card className="gap-4 py-5">
            <div className="flex flex-col gap-3 px-6 sm:flex-row sm:items-center sm:justify-between">
              <FilterChips items={STATUS_FILTERS} value={status} onChange={setStatus} />
              <FilterChips items={CHANNEL_FILTERS} value={channel} onChange={setChannel} />
            </div>

            {isLoading ? (
              <div className="space-y-2 px-6">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-12 rounded-xl" />
                ))}
              </div>
            ) : isError || !data ? (
              <ErrorState message="دریافت صف ارسال با خطا مواجه شد." />
            ) : data.items.length === 0 ? (
              <div className="px-6">
                <EmptyState
                  icon={Inbox}
                  title={status === "failed" ? "ارسال ناموفقی نیست." : "موردی نیست."}
                  description=""
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>زمان</TableHead>
                    <TableHead>گیرنده</TableHead>
                    <TableHead>پیام</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead>علت خطا</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((row) => (
                    <DeliveryTableRow key={row.id} row={row} onChanged={refresh} />
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      )}

      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title="ارسال دوبارهٔ همهٔ ناموفق‌ها"
        description={`${formatNumber(failedTotal)} مورد ناموفق (در ۳۰ روز گذشته) دوباره در صف قرار می‌گیرند و در اجرای بعدی کران‌جاب ارسال می‌شوند. اگر علت خطا رفع نشده (مثلاً کلید پیامک تنظیم نیست)، دوباره ناموفق می‌شوند.`}
        confirmLabel="ارسال دوباره"
        errorMessage="خطا در قرار دادن دوباره در صف."
        onConfirm={async () => {
          const { count } = await retryAllFailedDeliveries();
          toast.success(`${formatNumber(count)} مورد دوباره در صف قرار گرفت.`);
          refresh();
        }}
      />
    </div>
  );
}

function DeliveryTableRow({ row, onChanged }: { row: DeliveryRow; onChanged: () => void }) {
  const [busy, setBusy] = useState<"send" | "retry" | null>(null);
  const badge = STATUS_BADGE[row.status];

  async function act(kind: "send" | "retry") {
    setBusy(kind);
    try {
      if (kind === "send") {
        await sendDeliveryNow(row.id);
        toast.success("ارسال شد.");
      } else {
        await retryDelivery(row.id);
        toast.success("دوباره در صف قرار گرفت؛ در اجرای بعدی کران‌جاب ارسال می‌شود.");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "عملیات ناموفق بود."));
    } finally {
      setBusy(null);
      onChanged();
    }
  }

  return (
    <TableRow>
      <TableCell className="text-xs text-muted-foreground">
        {formatRelativeTime(parseSqlDate(row.created_at))}
      </TableCell>
      <TableCell>
        <p className="text-sm font-medium text-foreground">{fullName(row.first_name, row.last_name)}</p>
        <p dir="ltr" className="text-right text-xs text-muted-foreground">
          {row.channel === "sms" ? row.phone ?? "بدون موبایل" : row.email ?? "بدون ایمیل"}
        </p>
      </TableCell>
      <TableCell className="max-w-48 truncate text-sm text-muted-foreground" title={row.title}>
        <Badge variant="outline" className="me-1">
          {row.channel === "sms" ? "پیامک" : "ایمیل"}
        </Badge>
        {row.title}
      </TableCell>
      <TableCell>
        <Badge variant={badge.variant}>{badge.label}</Badge>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{formatNumber(row.attempts)} تلاش</p>
      </TableCell>
      <TableCell className="max-w-56 text-xs text-muted-foreground">
        {row.last_error ? (
          <span dir="ltr" className="line-clamp-2 break-words text-left" title={row.last_error}>
            {row.last_error}
          </span>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell>
        {row.status !== "sent" && (
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act("send")}>
              {busy === "send" ? <Loader2 className="animate-spin" /> : <Send />}
              ارسال همین حالا
            </Button>
            {row.status === "failed" && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy !== null}
                onClick={() => act("retry")}
                aria-label="قرار دادن دوباره در صف"
                title="قرار دادن دوباره در صف"
              >
                {busy === "retry" ? <Loader2 className="animate-spin" /> : <RotateCcw />}
              </Button>
            )}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
