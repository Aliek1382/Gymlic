import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export interface SearchResultItem {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  icon: LucideIcon;
}

export function SearchResultGroup({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: SearchResultItem[];
  onSelect: () => void;
}) {
  return (
    <div className="py-1">
      <p className="px-3 py-1 text-xs font-medium text-muted-foreground">{title}</p>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={`${title}-${item.id}`}
            href={item.href}
            onClick={onSelect}
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-muted"
          >
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-foreground">
              {item.label}
            </span>
            {item.sublabel && (
              <span dir="ltr" className="shrink-0 truncate text-xs text-muted-foreground">
                {item.sublabel}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
