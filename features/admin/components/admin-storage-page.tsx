"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileX2, FolderOpen, HardDrive, Trash2 } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber, formatRelativeTime } from "@/lib/persian";
import { ROLE_LABEL } from "@/components/layout/sidebar-nav";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import { SectionHeader } from "@/features/dashboard/components/shared/section-header";
import { StatisticCard } from "@/features/dashboard/components/shared/statistic-card";
import { StatisticsGrid } from "@/features/dashboard/components/shared/statistics-grid";
import type { AccountType } from "@/types/database.types";
import { useIsSuperAdmin } from "../hooks/use-admin-access";
import { cleanStorage, getStorage, type StorageFolder } from "../services/admin-ops-service";
import { formatBytes, parseSqlDate } from "../utils/format";

/** /admin/storage — upload space per account, and files nothing uses any more. */
export function AdminStoragePage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: ["admin", "storage"], queryFn: getStorage });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<"selected" | "all" | null>(null);
  // Seeing is the system permission's; removing (for good) is a super admin's.
  const canClean = useIsSuperAdmin();

  const accounts = data?.folders.filter((f) => f.kind === "user") ?? [];
  const toggle = (path: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  async function clean(paths: string[] | null) {
    const { deleted, freed_bytes } = await cleanStorage(paths);
    toast.success(`${formatNumber(deleted)} فایل پاک شد و ${formatBytes(freed_bytes)} آزاد شد.`);
    setSelected(new Set());
    void queryClient.invalidateQueries({ queryKey: ["admin", "storage"] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">فضای هاست</h1>
        <p className="text-sm text-muted-foreground">
          حجم فایل‌هایی که هر کاربر آپلود کرده، و فایل‌هایی که دیگر جایی از سایت به آن‌ها اشاره نمی‌کند: عکسی که عوض شده،
          مدرکی که آپلود شد ولی ذخیره نشد، یا پوشهٔ حسابی که برای همیشه پاک شده. فایلِ کاربرانِ داخل سطل زباله و فایل‌های
          کمتر از یک روزه هیچ‌وقت بی‌استفاده حساب نمی‌شوند. رسیدهای پرداخت جدا و خودکار پاک می‌شوند.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : isError || !data ? (
        <ErrorState message="خواندن پوشهٔ آپلود ناموفق بود." />
      ) : (
        <>
          <StatisticsGrid>
            <StatisticCard icon={HardDrive} title="کل فایل‌های آپلودی" value={formatBytes(data.total_bytes)} footer={<p className="text-xs text-muted-foreground">{formatNumber(data.total_files)} فایل</p>} />
            <StatisticCard icon={FolderOpen} title="کاربرانی که فایل دارند" value={formatNumber(accounts.length)} />
            <StatisticCard
              icon={FileX2}
              iconClassName="bg-warning-muted text-warning"
              title="فایل‌های بی‌استفاده"
              value={formatBytes(data.orphans.bytes)}
              footer={<p className="text-xs text-muted-foreground">{formatNumber(data.orphans.count)} فایل</p>}
            />
          </StatisticsGrid>

          <Tabs defaultValue={data.orphans.count > 0 ? "orphans" : "accounts"} className="space-y-4">
            <TabsList>
              <TabsTrigger value="orphans">بی‌استفاده ({formatNumber(data.orphans.count)})</TabsTrigger>
              <TabsTrigger value="accounts">حجم هر کاربر</TabsTrigger>
            </TabsList>

            <TabsContent value="orphans">
              <Card className="py-5">
                <SectionHeader
                  title="فایل‌های بی‌استفاده"
                  action={
                    !canClean ? (
                      <span className="text-xs text-muted-foreground">پاک‌کردن فایل‌ها فقط با مدیر کل است.</span>
                    ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={selected.size === 0} onClick={() => setConfirm("selected")}>
                        <Trash2 />
                        پاک‌کردن انتخاب‌شده‌ها ({formatNumber(selected.size)})
                      </Button>
                      <Button size="sm" variant="destructive" disabled={data.orphans.count === 0} onClick={() => setConfirm("all")}>
                        <Trash2 />
                        پاک‌کردن همه
                      </Button>
                    </div>
                    )
                  }
                />
                <div className="px-6">
                  {data.orphans.items.length === 0 ? (
                    <EmptyState icon={FileX2} title="فایل بی‌استفاده‌ای نیست." />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {canClean && <TableHead className="w-10" />}
                          <TableHead>فایل</TableHead>
                          <TableHead>حجم</TableHead>
                          <TableHead>آخرین تغییر</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.orphans.items.map((file) => (
                          <TableRow key={file.path}>
                            {canClean && (
                            <TableCell>
                              <input
                                type="checkbox"
                                className="size-4 accent-[var(--primary)]"
                                aria-label={`انتخاب ${file.path}`}
                                checked={selected.has(file.path)}
                                onChange={() => toggle(file.path)}
                              />
                            </TableCell>
                            )}
                            <TableCell className="font-mono text-xs" dir="ltr">
                              <div className="text-right">{file.path}</div>
                            </TableCell>
                            <TableCell className="text-sm">{formatBytes(file.bytes)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatRelativeTime(parseSqlDate(file.modified_at))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  {data.orphans.count > data.orphans.items.length && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatNumber(data.orphans.items.length)} فایل بزرگ‌تر از {formatNumber(data.orphans.count)} نشان داده
                      شده؛ «پاک‌کردن همه» همه را پاک می‌کند.
                    </p>
                  )}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="accounts">
              <Card className="py-5">
                <SectionHeader title="حجم آپلودی هر کاربر" />
                <div className="px-6">
                  {data.folders.length === 0 ? (
                    <EmptyState icon={FolderOpen} title="هنوز فایلی آپلود نشده است." />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>کاربر / پوشه</TableHead>
                          <TableHead>تعداد فایل</TableHead>
                          <TableHead>حجم</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.folders.map((folder) => (
                          <FolderRow key={folder.folder} folder={folder} max={data.folders[0]?.bytes ?? 1} />
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm === "all" ? "همهٔ فایل‌های بی‌استفاده پاک شوند؟" : `${formatNumber(selected.size)} فایل پاک شود؟`}
        description="هر فایل همین حالا دوباره بررسی می‌شود و اگر در این فاصله جایی استفاده شده باشد، می‌ماند. فایل پاک‌شده برنمی‌گردد."
        confirmLabel="پاک‌کردن"
        errorMessage="پاک‌کردن انجام نشد."
        onConfirm={() => clean(confirm === "all" ? null : [...selected])}
      />
    </div>
  );
}

function FolderRow({ folder, max }: { folder: StorageFolder; max: number }) {
  return (
    <TableRow>
      <TableCell>
        {folder.user ? (
          <div>
            <Link href={`/admin/users`} className="font-medium text-foreground hover:underline">
              {folder.user.name.trim() || folder.user.email || "بدون نام"}
            </Link>
            <p className="text-xs text-muted-foreground">
              {folder.user.account_type ? ROLE_LABEL[folder.user.account_type as AccountType] : "بدون نقش"}
              {folder.user.email && ` · ${folder.user.email}`}
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{folder.label ?? folder.folder}</span>
            {folder.deleted && <Badge variant="warning">حساب پاک‌شده</Badge>}
            {folder.in_trash && <Badge variant="outline">در سطل زباله</Badge>}
            {folder.kind === "system" && <Badge variant="outline">سیستمی</Badge>}
          </div>
        )}
      </TableCell>
      <TableCell className="text-sm">{formatNumber(folder.files)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (folder.bytes / Math.max(1, max)) * 100)}%` }} />
          </div>
          <span className="text-sm tabular-nums">{formatBytes(folder.bytes)}</span>
        </div>
      </TableCell>
    </TableRow>
  );
}
