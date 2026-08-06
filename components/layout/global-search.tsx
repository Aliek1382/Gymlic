"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";

import type { AccountType } from "@/types/database.types";
import { SearchResultGroup, type SearchResultItem } from "./search-result-group";
import { SIDEBAR_NAV } from "./sidebar-nav";

const TrainerSearchResults = dynamic(() => import("./trainer-search-results"), {
  ssr: false,
});

export function GlobalSearch({ accountType }: { accountType: AccountType }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [trainerResultCount, setTrainerResultCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const isTrainer = accountType === "trainer";

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const trimmedQuery = query.trim().toLowerCase();

  const pageResults: SearchResultItem[] = useMemo(() => {
    const items = SIDEBAR_NAV[accountType];
    const matches = trimmedQuery
      ? items.filter((item) => item.label.toLowerCase().includes(trimmedQuery))
      : items;
    return matches.map((item) => ({
      id: item.href,
      label: item.label,
      href: item.href,
      icon: item.icon,
    }));
  }, [accountType, trimmedQuery]);

  const handleResultCountChange = useCallback((count: number) => {
    setTrainerResultCount(count);
  }, []);

  function handleSelect() {
    setOpen(false);
  }

  const hasAnyResults = pageResults.length > 0 || (isTrainer && trainerResultCount > 0);

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <div className="flex items-center gap-2 rounded-full border border-input bg-muted/60 px-4 py-2 text-sm text-muted-foreground focus-within:border-ring">
        <Search className="size-4 shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="جستجوی سریع..."
          className="w-full min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden shrink-0 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] sm:inline-flex">
          ⌘K
        </kbd>
      </div>

      {open && (
        <div className="absolute inset-x-0 top-full z-40 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-popover p-2 shadow-lg sm:max-w-md">
          {!hasAnyResults && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              نتیجه‌ای برای «{query}» پیدا نشد.
            </p>
          )}

          {pageResults.length > 0 && (
            <SearchResultGroup title="صفحات" items={pageResults} onSelect={handleSelect} />
          )}

          {isTrainer && trimmedQuery && (
            <TrainerSearchResults
              query={trimmedQuery}
              onSelect={handleSelect}
              onResultCountChange={handleResultCountChange}
            />
          )}
        </div>
      )}
    </div>
  );
}
