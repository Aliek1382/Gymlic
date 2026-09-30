"use client";

import { useState } from "react";
import { Loader2, Newspaper } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { useNewsFeed } from "../hooks/use-news";
import type { NewsOrigin } from "../types/news-types";
import { NewsCard, ORIGIN_LABEL } from "./news-card";

const FILTERS: { value: NewsOrigin | null; label: string }[] = [
  { value: null, label: "همه" },
  { value: "admin", label: ORIGIN_LABEL.admin },
  { value: "wordpress", label: ORIGIN_LABEL.wordpress },
];

export function NewsList() {
  const [origin, setOrigin] = useState<NewsOrigin | null>(null);
  const feed = useNewsFeed(origin);
  const items = feed.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="فیلتر منبع خبر">
        {FILTERS.map((filter) => (
          <button
            key={filter.label}
            type="button"
            onClick={() => setOrigin(filter.value)}
            aria-pressed={origin === filter.value}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm transition-colors",
              origin === filter.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {feed.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      ) : feed.isError ? (
        <p className="text-sm text-destructive">
          دریافت اخبار با خطا مواجه شد. صفحه را دوباره بارگذاری کنید.
        </p>
      ) : items.length === 0 ? (
        <EmptyState icon={Newspaper} title="هنوز خبری منتشر نشده است." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
          {feed.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => feed.fetchNextPage()}
                disabled={feed.isFetchingNextPage}
              >
                {feed.isFetchingNextPage && <Loader2 className="animate-spin" />}
                نمایش بیشتر
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
