"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bug, CheckCheck, ChevronDown, Globe, Loader2, RotateCcw, Server, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber, formatRelativeTime } from "@/lib/persian";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import {
  clearResolvedErrors,
  listErrors,
  resolveAllErrors,
  setErrorResolved,
  type ErrorLogRow,
  type ErrorSource,
  type ErrorStatus,
} from "../services/admin-ops-service";
import { parseSqlDate } from "../utils/format";
import { MigrationNotice } from "./migration-notice";

const STATUS_FILTERS: { value: ErrorStatus; label: string }[] = [
  { value: "open", label: "باز" },
  { value: "resolved", label: "رفع‌شده" },
  { value: "all", label: "همه" },
];

const SOURCE_FILTERS: { value: ErrorSource | ""; label: string }[] = [
  { value: "", label: "سرور و مرورگر" },
  { value: "server", label: "سرور (PHP)" },
  { value: "browser", label: "مرورگر کاربران" },
];

function Chips<T extends string>({
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

/** /admin/errors — PHP errors and errors in users' browsers, one row per kind. */
export function AdminErrorsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ErrorStatus>("open");
  const [source, setSource] = useState<ErrorSource | "">("");
  const [confirm, setConfirm] = useState<"resolve" | "clear" | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "errors", status, source],
    queryFn: () => listErrors(status, source),
    placeholderData: (previous) => previous,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin", "errors"] });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">خطاهای سایت</h1>
          <p className="text-sm text-muted-foreground">
            خطاهای PHP در API و خطاهایی که در مرورگر کاربران رخ می‌دهد، بدون نیاز به FTP و فایل لاگ. هر نوع خطا یک ردیف
            است و تکرارش فقط شمارش را بالا می‌برد. خطای «رفع‌شده» اگر دوباره رخ دهد، باز برمی‌گردد.
          </p>
        </div>
        {data?.ready && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={!data.counts.open} onClick={() => setConfirm("resolve")}>
              <CheckCheck />
              همه رفع شد
            </Button>
            <Button variant="outline" size="sm" disabled={!data.counts.resolved} onClick={() => setConfirm("clear")}>
              <Trash2 />
              پاک‌کردن رفع‌شده‌ها
            </Button>
          </div>
        )}
      </div>

      {data && !data.ready && <MigrationNotice title="لاگ خطاها، سطل زباله و تأیید مدارک مربی (فاز ۱۰)" />}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Chips items={STATUS_FILTERS} value={status} onChange={setStatus} />
        <Chips items={SOURCE_FILTERS} value={source} onChange={setSource} />
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : isError || !data ? (
        <ErrorState message="دریافت خطاها ناموفق بود." />
      ) : data.items.length === 0 ? (
        <Card className="py-8">
          <EmptyState
            icon={Bug}
            title={status === "open" ? "خطای بازی نیست." : "موردی نیست."}
            description={status === "open" ? "اگر خطایی رخ دهد، همین‌جا نشان داده می‌شود." : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {data.items.map((row) => (
            <ErrorCard key={row.id} row={row} onChanged={refresh} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirm === "resolve"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="همهٔ خطاهای باز رفع شد؟"
        description="مثلاً بعد از استقراری که آن‌ها را درست کرده. هر کدام که دوباره رخ دهد، باز برمی‌گردد."
        confirmLabel="بله، همه رفع شد"
        errorMessage="انجام نشد."
        onConfirm={async () => {
          const { count } = await resolveAllErrors();
          toast.success(`${formatNumber(count)} خطا رفع‌شده علامت خورد.`);
          refresh();
        }}
      />
      <ConfirmDialog
        open={confirm === "clear"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="خطاهای رفع‌شده پاک شوند؟"
        description="فقط ردیف‌های رفع‌شده حذف می‌شوند؛ خطاهای باز می‌مانند."
        confirmLabel="پاک‌کردن"
        errorMessage="پاک‌کردن انجام نشد."
        onConfirm={async () => {
          const { count } = await clearResolvedErrors();
          toast.success(`${formatNumber(count)} ردیف پاک شد.`);
          refresh();
        }}
      />
    </div>
  );
}

function ErrorCard({ row, onChanged }: { row: ErrorLogRow; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const Icon = row.source === "server" ? Server : Globe;

  async function toggleResolved() {
    setBusy(true);
    try {
      await setErrorResolved(row.id, !row.resolved_at);
      onChanged();
    } catch (error) {
      toast.error(getErrorMessage(error, "انجام نشد."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={cn("gap-0 py-0", row.resolved_at && "opacity-70")}>
      <div className="flex items-start gap-3 px-4 py-3">
        <div
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
            row.source === "server" ? "bg-destructive/10 text-destructive" : "bg-warning-muted text-warning"
          )}
        >
          <Icon className="size-4" />
        </div>
        <button type="button" className="min-w-0 flex-1 space-y-1 text-start" onClick={() => setOpen((v) => !v)}>
          <p className="break-words font-mono text-[13px] leading-5 text-foreground" dir="ltr">
            {row.message}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <Badge variant={row.occurrences > 10 ? "destructive" : "outline"}>{formatNumber(row.occurrences)} بار</Badge>
            <span>آخرین بار {formatRelativeTime(parseSqlDate(row.last_seen))}</span>
            {row.url && (
              <span dir="ltr" className="font-mono">
                {row.url}
              </span>
            )}
            {row.resolved_at && <Badge variant="success">رفع‌شده</Badge>}
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant="ghost" disabled={busy} onClick={toggleResolved}>
            {busy ? <Loader2 className="animate-spin" /> : row.resolved_at ? <RotateCcw /> : <CheckCheck />}
            <span className="hidden sm:inline">{row.resolved_at ? "باز کن" : "رفع شد"}</span>
          </Button>
          <Button size="icon" variant="ghost" aria-label="جزئیات" onClick={() => setOpen((v) => !v)}>
            <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
          </Button>
        </div>
      </div>
      {open && (
        <div className="space-y-2 border-t border-border bg-muted/30 px-4 py-3 text-xs">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
            {row.location && <Field label="محل" value={row.location} ltr />}
            <Field label="اولین بار" value={formatRelativeTime(parseSqlDate(row.first_seen))} />
            {row.user_id && <Field label="آخرین کاربر" value={row.user_name?.trim() || row.user_email || "—"} />}
            {row.user_agent && <Field label="مرورگر" value={row.user_agent} ltr />}
          </dl>
          {row.detail && (
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-background p-3 font-mono text-[11px] leading-5" dir="ltr">
              {row.detail}
            </pre>
          )}
        </div>
      )}
    </Card>
  );
}

function Field({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted-foreground">{label}:</dt>
      <dd className="min-w-0 break-all font-medium text-foreground" dir={ltr ? "ltr" : undefined}>
        {value}
      </dd>
    </div>
  );
}
