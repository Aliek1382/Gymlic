"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, DatabaseZap, FileWarning, Loader2, Play, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatNumber, formatPersianDate } from "@/lib/persian";
import { getErrorMessage } from "@/lib/get-error-message";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import {
  downloadBackup,
  listMigrations,
  runMigration,
  type MigrationResult,
  type MigrationRow,
} from "../services/admin-system-service";
import { parseSqlDate } from "../utils/format";

export function AdminDatabasePage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "system", "migrations"],
    queryFn: listMigrations,
  });
  const [target, setTarget] = useState<MigrationRow | null>(null);
  const [failure, setFailure] = useState<{ title: string; result: MigrationResult } | null>(null);

  const rows = data ?? [];
  const pending = rows.filter((row) => row.state === "pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">به‌روزرسانی دیتابیس</h1>
        <p className="text-sm text-muted-foreground">
          تغییرهای دیتابیس که همراه نسخه‌های جدید بک‌اند می‌آیند. به‌جای کپی‌کردن SQL در phpMyAdmin،
          بعد از آپلود بک‌اند همین‌جا اجرایشان کنید. فقط فایل‌های بررسی‌شده‌ای که همراه کد آمده‌اند
          اجرا می‌شوند؛ تایپ‌کردن SQL دلخواه عمداً ممکن نیست.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : isError ? (
        <ErrorState message="دریافت فهرست به‌روزرسانی‌ها با خطا مواجه شد." />
      ) : (
        <>
          <div
            className={cn(
              "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
              pending.length === 0
                ? "border-success/30 bg-success-muted text-success"
                : "border-warning/30 bg-warning-muted text-warning"
            )}
          >
            {pending.length === 0 ? (
              <CircleCheck className="mt-0.5 size-5 shrink-0" />
            ) : (
              <TriangleAlert className="mt-0.5 size-5 shrink-0" />
            )}
            <p className="leading-6">
              {pending.length === 0
                ? "دیتابیس به‌روز است؛ همهٔ تغییرها روی آن انجام شده‌اند."
                : `${formatNumber(pending.length)} به‌روزرسانی در انتظار اجراست. تا اجرا نشوند، بخش‌هایی از سایت که به آن‌ها نیاز دارند کامل کار نمی‌کنند. قبل از اجرا یک نسخهٔ پشتیبان بگیرید.`}
            </p>
          </div>

          <Card className="gap-3 py-5">
            <div className="px-6">
              <CardTitle className="text-base">
                تغییرها ({formatNumber(rows.length)})
              </CardTitle>
            </div>
            <div className="space-y-2 px-6">
              {/* Pending first: that's what the page is for. */}
              {[...pending, ...rows.filter((row) => row.state === "applied")].map((row) => (
                <div
                  key={row.id}
                  className={cn(
                    "flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center",
                    row.state === "pending" ? "border-warning/40" : "border-border"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{row.title}</p>
                    <p dir="ltr" className="text-right text-[11px] text-muted-foreground">
                      {row.file} · {row.statements} statements
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground sm:w-56">
                    {row.state === "applied"
                      ? row.ran_at
                        ? `از همین پنل اجرا شد — ${formatPersianDate(parseSqlDate(row.ran_at))}${row.ran_by_name ? ` (${row.ran_by_name})` : ""}`
                        : "قبلاً (دستی یا هنگام نصب) انجام شده"
                      : !row.file_found
                        ? "فایلش روی هاست نیست؛ بک‌اند را دوباره آپلود کنید."
                        : "هنوز روی دیتابیس انجام نشده"}
                  </div>
                  {row.state === "applied" ? (
                    <Badge variant="success">انجام‌شده</Badge>
                  ) : (
                    <Button size="sm" disabled={!row.file_found} onClick={() => setTarget(row)}>
                      <Play />
                      اجرا
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <RunDialog
        target={target}
        onClose={() => setTarget(null)}
        onDone={(row, result) => {
          void queryClient.invalidateQueries({ queryKey: ["admin", "system", "migrations"] });
          if (result.ok) {
            toast.success(
              result.skipped > 0
                ? `«${row.title}» انجام شد (${formatNumber(result.executed)} دستور اجرا شد، ${formatNumber(result.skipped)} دستور از قبل انجام شده بود).`
                : `«${row.title}» انجام شد.`
            );
          } else {
            setFailure({ title: row.title, result });
          }
        }}
      />

      <Dialog open={!!failure} onOpenChange={(open) => !open && setFailure(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <FileWarning className="size-5" />
              اجرای «{failure?.title}» کامل نشد
            </DialogTitle>
            <DialogDescription>
              {failure && failure.result.executed + failure.result.skipped > 0
                ? `${formatNumber(failure.result.executed + failure.result.skipped)} دستور اول انجام شد و بعد خطا رخ داد. بعد از رفع مشکل می‌توانید دوباره «اجرا» بزنید؛ دستورهای انجام‌شده خودکار رد می‌شوند.`
                : "هیچ تغییری روی دیتابیس انجام نشد."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="font-medium text-foreground">پیام دیتابیس:</p>
            <pre dir="ltr" className="whitespace-pre-wrap break-words rounded-xl bg-muted p-3 text-left text-xs">
              {failure?.result.error}
            </pre>
            {failure?.result.failed_statement && (
              <>
                <p className="font-medium text-foreground">دستوری که خطا داد:</p>
                <pre dir="ltr" className="max-h-48 overflow-auto rounded-xl bg-muted p-3 text-left text-xs">
                  {failure.result.failed_statement}
                </pre>
              </>
            )}
            <p className="text-xs text-muted-foreground">
              این متن را برای پشتیبانی فنی بفرستید.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RunDialog({
  target,
  onClose,
  onDone,
}: {
  target: MigrationRow | null;
  onClose: () => void;
  onDone: (row: MigrationRow, result: MigrationResult) => void;
}) {
  const [running, setRunning] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [backedUp, setBackedUp] = useState(false);

  function close() {
    if (running) return;
    setBackedUp(false);
    onClose();
  }

  async function backup() {
    setBackingUp(true);
    try {
      await downloadBackup();
      setBackedUp(true);
      toast.success("نسخهٔ پشتیبان دانلود شد.");
    } catch (error) {
      toast.error(getErrorMessage(error, "دریافت نسخهٔ پشتیبان ناموفق بود."));
    } finally {
      setBackingUp(false);
    }
  }

  async function run() {
    if (!target) return;
    setRunning(true);
    try {
      const result = await runMigration(target.id);
      onDone(target, result);
      setBackedUp(false);
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, "اجرا با خطا مواجه شد."));
    } finally {
      setRunning(false);
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>اجرای «{target?.title}»</DialogTitle>
          <DialogDescription>
            تغییر ساختار دیتابیس برگشت‌پذیر نیست. اول یک نسخهٔ پشتیبان بگیرید، بعد اجرا کنید. اجرا
            معمولاً چند ثانیه طول می‌کشد؛ تا تمام نشده صفحه را نبندید.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-4 py-3 text-sm">
          <DatabaseZap className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1">
            {backedUp ? "نسخهٔ پشتیبان گرفته شد." : "نسخهٔ پشتیبان هنوز گرفته نشده."}
          </span>
          <Button size="sm" variant="outline" onClick={backup} disabled={backingUp || running}>
            {backingUp && <Loader2 className="animate-spin" />}
            دانلود پشتیبان
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={run} disabled={running || backingUp}>
            {running ? <Loader2 className="animate-spin" /> : <Play />}
            {backedUp ? "اجرا" : "بدون پشتیبان اجرا کن"}
          </Button>
          <Button variant="outline" onClick={close} disabled={running}>
            انصراف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
