"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { getErrorMessage } from "@/lib/get-error-message";
import { formatPersianDate, formatRelativeTime, toPersianDigits } from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import { listTrash, purgeTrash, restoreTrash, type TrashItem } from "../services/admin-ops-service";
import { parseSqlDate } from "../utils/format";
import { MigrationNotice } from "./migration-notice";

/** Everything that may have shown the deleted item. */
const AFFECTED = [["admin"], ["site-pages"]];

/** /admin/trash — what was deleted, restorable for 30 days. */
export function AdminTrashPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: ["admin", "trash"], queryFn: listTrash });
  const [busy, setBusy] = useState<string | null>(null);
  const [purging, setPurging] = useState<TrashItem | null>(null);

  async function restore(item: TrashItem) {
    setBusy(item.id);
    try {
      await restoreTrash(item.id);
      toast.success(`«${item.label}» بازگردانده شد.`);
      for (const key of AFFECTED) void queryClient.invalidateQueries({ queryKey: key });
    } catch (error) {
      toast.error(getErrorMessage(error, "بازگرداندن انجام نشد."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">سطل زباله</h1>
        <p className="text-sm text-muted-foreground">
          کاربر، باشگاه، صفحهٔ متنی و کد تخفیفی که حذف می‌شود، همراه با هر چه به آن وابسته بوده (برنامه‌ها، پیام‌ها،
          پرداخت‌ها و…) تا {toPersianDigits(data?.retention_days ?? 30)} روز اینجا می‌ماند و با یک دکمه برمی‌گردد. بعد از
          آن برای همیشه پاک می‌شود. نشست‌های ورود برنمی‌گردند: کاربرِ بازگردانده دوباره وارد می‌شود.
        </p>
      </div>

      {data && !data.ready && <MigrationNotice title="لاگ خطاها، سطل زباله و تأیید مدارک مربی (فاز ۱۰)" />}

      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : isError || !data ? (
        <ErrorState message="دریافت سطل زباله ناموفق بود." />
      ) : data.items.length === 0 ? (
        <Card className="py-8">
          <EmptyState icon={Trash2} title="سطل زباله خالی است." />
        </Card>
      ) : (
        <Card className="py-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>مورد</TableHead>
                <TableHead>حذف شده</TableHead>
                <TableHead>پاک‌شدن برای همیشه</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{item.kind_label}</Badge>
                      <span className="font-medium text-foreground">{item.label}</span>
                    </div>
                    {item.summary && <p className="mt-1 text-xs text-muted-foreground">{item.summary}</p>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatRelativeTime(parseSqlDate(item.deleted_at))}
                    {item.deleted_by_name && (
                      <span className="block text-xs text-muted-foreground">توسط {item.deleted_by_name}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatPersianDate(parseSqlDate(item.purge_at))}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => restore(item)}>
                        {busy === item.id ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                        بازگرداندن
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={busy !== null}
                        onClick={() => setPurging(item)}
                        aria-label={`پاک‌کردن همیشگی ${item.label}`}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <ConfirmDialog
        open={!!purging}
        onOpenChange={(open) => !open && setPurging(null)}
        title={`«${purging?.label ?? ""}» برای همیشه پاک شود؟`}
        description={
          purging?.kind === "user"
            ? "این حساب و همهٔ اطلاعاتش، و فایل‌هایی که آپلود کرده بود، دیگر قابل بازگرداندن نیستند."
            : "دیگر قابل بازگرداندن نیست."
        }
        confirmLabel="پاک‌کردن همیشگی"
        errorMessage="پاک‌کردن انجام نشد."
        onConfirm={async () => {
          if (!purging) return;
          await purgeTrash(purging.id);
          toast.success("برای همیشه پاک شد.");
          void queryClient.invalidateQueries({ queryKey: ["admin", "trash"] });
        }}
      />
    </div>
  );
}
