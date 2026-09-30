import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/persian";
import type { NewsItem, NewsOrigin } from "../types/news-types";

export const ORIGIN_LABEL: Record<NewsOrigin, string> = {
  admin: "اخبار جیم‌لیک",
  wordpress: "مقالات وب‌سایت",
};

/**
 * An imported article opens on gymlic.ir in a new tab; an admin's item opens
 * its own page in the panel. Text is rendered as text, never as HTML.
 */
export function NewsCard({ item }: { item: NewsItem }) {
  const inner = (
    <Card className="h-full gap-3 overflow-hidden py-0 transition-colors hover:border-primary/40">
      {item.imageUrl && (
        // A plain <img>: the static export has no image optimizer, and the
        // address is an external one.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-40 w-full object-cover"
        />
      )}
      <div className="space-y-2 px-5 pt-2 pb-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{ORIGIN_LABEL[item.origin]}</Badge>
          <span>{formatRelativeTime(new Date(item.publishedAt))}</span>
          {item.origin === "wordpress" && <ExternalLink className="ms-auto size-3.5" />}
        </div>
        <h2 className="text-base font-bold leading-7 text-foreground">{item.title}</h2>
        {item.summary && (
          <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{item.summary}</p>
        )}
      </div>
    </Card>
  );

  if (item.origin === "wordpress" && item.link) {
    return (
      <a href={item.link} target="_blank" rel="noopener noreferrer" className="block">
        {inner}
      </a>
    );
  }
  return (
    <Link href={`/news/detail?id=${item.id}`} className="block">
      {inner}
    </Link>
  );
}
