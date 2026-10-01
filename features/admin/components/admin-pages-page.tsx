"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileText, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatRelativeTime, parseLocaleNumber } from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import { MarkdownView } from "@/features/site-pages/components/markdown-view";
import {
  deleteAdminPage,
  listAdminPages,
  saveAdminPage,
  type AdminPageRow,
} from "../services/admin-communication-service";

const QUERY_KEY = ["admin", "pages"] as const;

export function AdminPagesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: QUERY_KEY, queryFn: listAdminPages });
  const [editing, setEditing] = useState<AdminPageRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminPageRow | null>(null);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ["site-pages"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">صفحه‌های متنی</h1>
          <p className="text-sm text-muted-foreground">
            قوانین، حریم خصوصی، سؤالات متداول، راهنما یا هر صفحهٔ دیگر. صفحه‌های منتشرشده زیر فرم ورود و
            پایین منوی پنل کاربران لینک می‌شوند و بدون ورود هم خوانده می‌شوند.
          </p>
        </div>
        {data?.ready && (
          <Button onClick={() => setEditing("new")}>
            <Plus />
            صفحهٔ جدید
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : isError || !data ? (
        <ErrorState message="دریافت صفحه‌ها با خطا مواجه شد." />
      ) : !data.ready ? (
        <Card className="py-8">
          <div className="px-6">
            <EmptyState
              icon={FileText}
              title="صفحه‌های متنی هنوز فعال نیست."
              description="به‌روزرسانی «اعلان همگانی، تیکت پشتیبانی و صفحه‌های متنی (فاز ۷)» را از صفحهٔ «به‌روزرسانی دیتابیس» اجرا کنید."
            />
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {data.items.map((page) => (
            <Card key={page.slug} className="gap-2 py-4">
              <div className="flex items-start gap-3 px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{page.title}</p>
                    {page.is_published ? (
                      <Badge variant="success">منتشرشده</Badge>
                    ) : (
                      <Badge variant="secondary">{page.body.trim() ? "پیش‌نویس" : "خالی"}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span dir="ltr">/page?slug={page.slug}</span> · {formatRelativeTime(new Date(page.updated_at))}
                    {page.updated_by_name ? ` · ${page.updated_by_name}` : ""}
                  </p>
                </div>
                {page.is_published && (
                  <Button size="icon" variant="ghost" asChild aria-label={`دیدن ${page.title}`}>
                    <Link href={`/page?slug=${page.slug}`} target="_blank">
                      <ExternalLink />
                    </Link>
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setEditing(page)}>
                  <Pencil />
                  ویرایش
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setDeleting(page)}
                  aria-label={`حذف ${page.title}`}
                >
                  <Trash2 />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <PageEditor
        key={editing === "new" ? "new" : (editing?.slug ?? "closed")}
        page={editing}
        taken={(data?.items ?? []).map((p) => p.slug)}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`حذف صفحهٔ «${deleting?.title ?? ""}»`}
        description="صفحه و لینک‌هایش از سایت برداشته می‌شود. اگر فقط نمی‌خواهید دیده شود، انتشارش را خاموش کنید."
        confirmLabel="حذف"
        errorMessage="حذف صفحه ناموفق بود."
        onConfirm={async () => {
          if (!deleting) return;
          await deleteAdminPage(deleting.slug);
          toast.success("صفحه حذف شد.");
          refresh();
        }}
      />
    </div>
  );
}

function PageEditor({
  page,
  taken,
  onClose,
  onSaved,
}: {
  page: AdminPageRow | "new" | null;
  taken: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const existing = page && page !== "new" ? page : null;
  const [slug, setSlug] = useState(existing?.slug ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [published, setPublished] = useState(existing?.is_published ?? false);
  const [sortOrder, setSortOrder] = useState(String(existing?.sort_order ?? 10));
  const [saving, setSaving] = useState(false);

  async function save() {
    const cleanSlug = slug.trim().toLowerCase();
    if (!existing) {
      if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(cleanSlug)) {
        toast.error("نشانی باید ۲ تا ۶۰ حرف کوچک انگلیسی، عدد یا خط تیره باشد؛ مثلاً about-us");
        return;
      }
      if (taken.includes(cleanSlug)) {
        toast.error("صفحه‌ای با همین نشانی هست.");
        return;
      }
    }
    if (!title.trim()) {
      toast.error("عنوان صفحه را وارد کنید.");
      return;
    }
    if (published && !body.trim()) {
      toast.error("صفحهٔ خالی منتشر نمی‌شود؛ اول متنش را بنویسید.");
      return;
    }
    setSaving(true);
    try {
      await saveAdminPage(existing?.slug ?? cleanSlug, {
        title: title.trim(),
        body,
        is_published: published,
        sort_order: Math.max(0, parseLocaleNumber(sortOrder) ?? 0),
      });
      toast.success(published ? "صفحه ذخیره و منتشر شد." : "صفحه ذخیره شد.");
      onSaved();
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیرهٔ صفحه ناموفق بود."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!page} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{existing ? `ویرایش «${existing.title}»` : "صفحهٔ جدید"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_12rem_6rem]">
            <div className="space-y-2">
              <Label htmlFor="page-title">عنوان</Label>
              <Input id="page-title" value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="page-slug">نشانی</Label>
              <Input
                id="page-slug"
                dir="ltr"
                value={slug}
                disabled={!!existing}
                placeholder="about-us"
                onChange={(e) => setSlug(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="page-order">ترتیب</Label>
              <Input id="page-order" dir="ltr" inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
            </div>
          </div>

          <Tabs defaultValue="write">
            <TabsList>
              <TabsTrigger value="write">نوشتن</TabsTrigger>
              <TabsTrigger value="preview">پیش‌نمایش</TabsTrigger>
            </TabsList>
            <TabsContent value="write" className="space-y-2">
              <textarea
                rows={16}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full rounded-xl border border-input bg-transparent px-4 py-3 text-sm leading-7 shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
              />
              <p className="text-xs leading-6 text-muted-foreground">
                بین پاراگراف‌ها یک خط خالی بگذارید. <span dir="ltr" className="font-mono">## عنوان</span> برای تیتر،{" "}
                <span dir="ltr" className="font-mono">- مورد</span> برای فهرست،{" "}
                <span dir="ltr" className="font-mono">**متن**</span> برای پررنگ، و{" "}
                <span dir="ltr" className="font-mono">[متن](https://…)</span> برای لینک.
              </p>
            </TabsContent>
            <TabsContent value="preview">
              <div className="min-h-64 rounded-xl border border-border p-5">
                {body.trim() ? (
                  <MarkdownView text={body} />
                ) : (
                  <p className="text-sm text-muted-foreground">هنوز متنی ننوشته‌اید.</p>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <Switch checked={published} onCheckedChange={setPublished} />
            منتشر شود (برای همه قابل دیدن و در لینک‌ها)
          </label>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            ذخیره
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
