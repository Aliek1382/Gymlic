"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { RouteLoading } from "@/components/layout/route-loading";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatPersianDate } from "@/lib/persian";
import { useNewsItem } from "../hooks/use-news";
import { ORIGIN_LABEL } from "./news-card";

/** One admin-written item in full. The body is shown as text (line breaks kept), never as HTML. */
export function NewsDetail() {
  const id = useSearchParams().get("id");
  const news = useNewsItem(id);

  if (news.isLoading) return <RouteLoading />;

  return (
    <div className="space-y-4">
      <Link
        href="/news"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4" />
        همه اخبار
      </Link>

      {news.isError || !news.data ? (
        <p className="text-sm text-destructive">این خبر پیدا نشد یا دیگر منتشر نمی‌شود.</p>
      ) : (
        <Card className="gap-4 overflow-hidden py-0">
          {news.data.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={news.data.imageUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="max-h-80 w-full object-cover"
            />
          )}
          <div className="space-y-3 px-6 pt-2 pb-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{ORIGIN_LABEL[news.data.origin]}</Badge>
              <span>{formatPersianDate(new Date(news.data.publishedAt))}</span>
            </div>
            <h1 className="text-xl font-bold leading-8 text-foreground">{news.data.title}</h1>
            <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">{news.data.body}</p>
          </div>
        </Card>
      )}
    </div>
  );
}
