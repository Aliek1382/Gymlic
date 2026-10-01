"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { RoleGate } from "@/features/authentication/components/role-gate";
import { useFeatureCheck } from "@/features/site-settings";
import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/persian";
import { TRAINER_HELP, type HelpCategory } from "../content/trainer-help";

/** The category named in the URL hash (`/help#plans`), so other pages can link straight to one. */
function categoryFromHash(categories: HelpCategory[]): string | null {
  const id = window.location.hash.replace("#", "");
  return categories.some((category) => category.id === id) ? id : null;
}

export function TrainerHelpPage() {
  const isEnabled = useFeatureCheck();

  // A section the admin switched off has no page for the trainer, so its guide
  // would only describe something they can't open.
  const categories = TRAINER_HELP.map((category) => ({
    ...category,
    guides: category.guides.filter((guide) => isEnabled(guide.feature ?? null)),
  })).filter((category) => category.guides.length > 0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = categories.find((category) => category.id === selectedId) ?? categories[0];

  useEffect(() => {
    const fromHash = categoryFromHash(TRAINER_HELP);
    if (fromHash) setSelectedId(fromHash);
  }, []);

  function select(id: string) {
    setSelectedId(id);
    window.history.replaceState(null, "", `#${id}`);
  }

  return (
    <RoleGate allow={["trainer"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">راهنمای استفاده</h1>
          <p className="text-sm text-muted-foreground">
            یک بخش را انتخاب کنید تا راهنمای مرحله‌به‌مرحلهٔ همان بخش را ببینید.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3" role="tablist" aria-label="بخش‌های راهنما">
          {categories.map((category) => {
            const Icon = category.icon;
            const active = category.id === selected?.id;
            return (
              <button
                key={category.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => select(category.id)}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border p-3 text-right transition-colors",
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-muted"
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl",
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="size-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">
                    {category.title}
                  </span>
                  <span className="block text-xs leading-5 text-muted-foreground">
                    {category.summary}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {selected && (
          <div className="space-y-4" role="tabpanel">
            <h2 className="text-lg font-bold text-foreground">{selected.title}</h2>

            {selected.guides.map((guide) => (
              <Card key={guide.title} className="gap-4 p-5">
                <h3 className="text-base font-semibold text-foreground">{guide.title}</h3>

                <ol className="space-y-3">
                  {guide.steps.map((step, index) => (
                    <li key={step} className="flex gap-3 text-sm leading-7 text-foreground">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {toPersianDigits(index + 1)}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>

                {guide.note && (
                  <p className="rounded-xl bg-muted/60 p-3 text-xs leading-6 text-muted-foreground">
                    {guide.note}
                  </p>
                )}

                {guide.href && guide.linkLabel && (
                  <Link
                    href={guide.href}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    رفتن به «{guide.linkLabel}»
                  </Link>
                )}
              </Card>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          جواب سؤالتان را پیدا نکردید؟ اگر دکمهٔ پشتیبانی بالای صفحه نمایش داده می‌شود، از آن با ما تماس بگیرید.
        </p>
      </div>
    </RoleGate>
  );
}
