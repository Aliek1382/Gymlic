"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/get-error-message";
import { createNews, getAdminNews, updateNews } from "../services/news-service";
import type { NewsInput } from "../types/news-types";

const EMPTY: NewsInput = { title: "", summary: "", body: "", imageUrl: "", isPublished: true };
const TEXTAREA_CLASS =
  "w-full rounded-xl border border-input bg-transparent px-4 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

/** «خبر جدید» when given no id, «ویرایش» when given one (the full item is fetched on open). */
export function NewsFormDialog({ newsId }: { newsId?: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<NewsInput>(EMPTY);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;

    if (!newsId) {
      setValues(EMPTY);
      return;
    }
    setIsLoading(true);
    try {
      const item = await getAdminNews(newsId);
      setValues({
        title: item.title,
        summary: item.summary ?? "",
        body: item.body ?? "",
        imageUrl: item.imageUrl ?? "",
        isPublished: item.isPublished,
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "دریافت خبر با خطا مواجه شد."));
      setOpen(false);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!values.title.trim() || !values.body.trim()) {
      toast.error("عنوان و متن خبر را وارد کنید.");
      return;
    }

    setIsSaving(true);
    try {
      if (newsId) {
        await updateNews(newsId, values);
        toast.success("خبر به‌روزرسانی شد.");
      } else {
        await createNews(values);
        toast.success(values.isPublished ? "خبر منتشر شد." : "خبر به‌صورت پیش‌نویس ذخیره شد.");
      }
      await queryClient.invalidateQueries({ queryKey: ["news"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "news"] });
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "ثبت خبر با خطا مواجه شد."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {newsId ? (
          <Button size="sm" variant="outline">
            <Pencil />
            ویرایش
          </Button>
        ) : (
          <Button>
            <Plus />
            خبر جدید
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{newsId ? "ویرایش خبر" : "خبر جدید"}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="news-title">عنوان</Label>
              <Input
                id="news-title"
                value={values.title}
                maxLength={500}
                onChange={(e) => setValues({ ...values, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="news-summary">خلاصه (اختیاری، روی کارت نمایش داده می‌شود)</Label>
              <textarea
                id="news-summary"
                rows={2}
                maxLength={1000}
                value={values.summary}
                onChange={(e) => setValues({ ...values, summary: e.target.value })}
                className={TEXTAREA_CLASS}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="news-body">متن خبر</Label>
              <textarea
                id="news-body"
                rows={8}
                maxLength={50000}
                value={values.body}
                onChange={(e) => setValues({ ...values, body: e.target.value })}
                className={TEXTAREA_CLASS}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="news-image">آدرس عکس (اختیاری)</Label>
              <Input
                id="news-image"
                dir="ltr"
                placeholder="https://"
                value={values.imageUrl}
                onChange={(e) => setValues({ ...values, imageUrl: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <Label htmlFor="news-published">منتشر شود</Label>
              <Switch
                id="news-published"
                checked={values.isPublished}
                onCheckedChange={(checked) => setValues({ ...values, isPublished: checked })}
              />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="animate-spin" />}
                {newsId ? "ذخیره تغییرات" : "ثبت خبر"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
