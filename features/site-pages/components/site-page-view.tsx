"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";

import { BrandMark, BrandName } from "@/components/brand/brand-mark";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPersianDate } from "@/lib/persian";
import { getSitePage } from "../services/site-pages-service";
import { MarkdownView } from "./markdown-view";
import { SitePageLinks } from "./site-page-links";

/** /page?slug=terms — a text page the admin wrote; readable without signing in. */
export function SitePageView() {
  const slug = useSearchParams().get("slug") ?? "";
  const { data, isLoading, isError } = useQuery({
    queryKey: ["site-page", slug],
    queryFn: () => getSitePage(slug),
    enabled: slug.length > 0,
    retry: false,
  });

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground" iconClassName="size-5" />
            <span className="text-lg font-bold text-foreground"><BrandName /></span>
          </Link>
          <Link href="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowRight className="size-4" />
            بازگشت
          </Link>
        </div>

        <article className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-40" />
            </div>
          ) : isError || !data ? (
            <div className="space-y-2 py-10 text-center">
              <h1 className="text-lg font-bold text-foreground">این صفحه پیدا نشد</h1>
              <p className="text-sm text-muted-foreground">ممکن است هنوز منتشر نشده یا حذف شده باشد.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-1 border-b border-border pb-4">
                <h1 className="text-2xl font-bold text-foreground">{data.title}</h1>
                <p className="text-xs text-muted-foreground">
                  آخرین به‌روزرسانی: {formatPersianDate(new Date(data.updated_at))}
                </p>
              </div>
              <MarkdownView text={data.body} />
            </div>
          )}
        </article>

        <SitePageLinks current={slug} />
      </div>
    </div>
  );
}
