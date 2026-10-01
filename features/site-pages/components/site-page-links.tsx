"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { listSitePages } from "../services/site-pages-service";

/**
 * Links to the published text pages (terms, privacy, FAQ…). Renders nothing
 * until the admin publishes one.
 */
export function SitePageLinks({
  current,
  className,
  onNavigate,
}: {
  current?: string;
  className?: string;
  onNavigate?: () => void;
}) {
  const { data } = useQuery({
    queryKey: ["site-pages"],
    queryFn: listSitePages,
    staleTime: 10 * 60 * 1000,
  });
  if (!data || data.length === 0) return null;

  return (
    <nav className={cn("flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground", className)}>
      {data.map((page) => (
        <Link
          key={page.slug}
          href={`/page?slug=${page.slug}`}
          onClick={onNavigate}
          className={cn("hover:text-foreground hover:underline", page.slug === current && "font-medium text-foreground")}
        >
          {page.title}
        </Link>
      ))}
    </nav>
  );
}
