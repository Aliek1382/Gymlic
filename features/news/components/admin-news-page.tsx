"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Newspaper, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { formatNumber, formatRelativeTime } from "@/lib/persian";
import { deleteNews, listAdminNews } from "../services/news-service";
import type { NewsItem } from "../types/news-types";
import { ORIGIN_LABEL } from "./news-card";
import { NewsFormDialog } from "./news-form-dialog";

export function AdminNewsPage() {
  const queryClient = useQueryClient();
  const [toDelete, setToDelete] = useState<NewsItem | null>(null);
  const { data } = useQuery({ queryKey: ["admin", "news"], queryFn: listAdminNews });
  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">اخبار</h1>
          <p className="text-sm text-muted-foreground">
            خبری که اینجا منتشر کنید برای همه مربیان و ورزشکاران نمایش داده می‌شود. مقالات
            gymlic.ir خودکار از فید سایت می‌آیند و از اینجا ویرایش نمی‌شوند.
          </p>
        </div>
        <NewsFormDialog />
      </div>

      <Card className="gap-4 py-5">
        <div className="px-6">
          <CardTitle className="text-base">همه اخبار ({formatNumber(rows.length)})</CardTitle>
        </div>

        {rows.length === 0 ? (
          <div className="px-6">
            <EmptyState
              icon={Newspaper}
              title="هنوز خبری نیست."
              description="اولین خبر را منتشر کنید؛ مقالات gymlic.ir هم بعد از اجرای کرون اینجا می‌آیند."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>عنوان</TableHead>
                <TableHead>منبع</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead>تاریخ</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-xs truncate font-medium text-foreground">
                    {item.title}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{ORIGIN_LABEL[item.origin]}</TableCell>
                  <TableCell>
                    <Badge variant={item.isPublished ? "success" : "outline"}>
                      {item.isPublished ? "منتشرشده" : "پیش‌نویس"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatRelativeTime(new Date(item.publishedAt))}
                  </TableCell>
                  <TableCell>
                    {item.origin === "admin" ? (
                      <div className="flex gap-2">
                        <NewsFormDialog newsId={item.id} />
                        <Button size="sm" variant="outline" onClick={() => setToDelete(item)}>
                          <Trash2 />
                          حذف
                        </Button>
                      </div>
                    ) : (
                      item.link && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={item.link} target="_blank" rel="noopener noreferrer">
                            <ExternalLink />
                            مشاهده در سایت
                          </a>
                        </Button>
                      )
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="حذف خبر"
        description={`«${toDelete?.title ?? ""}» برای همیشه حذف می‌شود.`}
        confirmLabel="حذف"
        errorMessage="حذف خبر با خطا مواجه شد."
        onConfirm={async () => {
          if (!toDelete) return;
          await deleteNews(toDelete.id);
          await queryClient.invalidateQueries({ queryKey: ["admin", "news"] });
          await queryClient.invalidateQueries({ queryKey: ["news"] });
        }}
      />
    </div>
  );
}
