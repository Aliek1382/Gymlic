"use client";

import { CollapsibleSection } from "@/components/ui/collapsible-section";

// What a trainer typing into the description box can write and still get a
// formatted table instead of a plain paragraph. A placeholder would vanish
// the moment they start typing — which is exactly when they need it — so
// this sits under the field as a collapsed section they can reopen.
const EXAMPLES: { label: string; lines: string[] }[] = [
  {
    label: "حرکت معمولی — هر سه شکل یک نتیجه می‌دهند",
    lines: ["پرس سینه — 4 ست × 12 تکرار", "پرس سینه 4x12", "پرس سینه: 4/12"],
  },
  {
    label: "سوپرست و تری‌ست — حرکت‌ها را با + یا «و» جدا کنید",
    lines: [
      "سوپرست (4 دور): پرس سینه × 12 تکرار + پرس شانه × 10 تکرار",
      "تری‌ست 3 دور: اسکوات x10 و لانج x12 و پرس پا x8",
    ],
  },
  {
    label: "دراپ‌ست — تکرارهای نزولی را با ← یا ویرگول یا خط تیره",
    lines: ["جلو بازو — دراپ‌ست: 12، 10، 8 تکرار", "جلو بازو دراپ‌ست: 12-10-8"],
  },
  {
    label: "روز تمرین — یک خط جدا که به «:» ختم شود",
    lines: ["شنبه:"],
  },
];

export function PlanFormatHint() {
  return (
    <CollapsibleSection title="راهنمای نوشتن دستی (اختیاری)">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          اگر مستقیم تایپ می‌کنید، نوشتن به هر یک از شکل‌های زیر باعث می‌شود آن
          خط به‌صورت جدول نمایش داده شود. «تکرار» را می‌توانید «تا» بنویسید یا
          کلاً ننویسید، و ارقام فارسی هم پذیرفته می‌شوند. هر خطی که با این
          شکل‌ها نخواند، دست‌نخورده به‌صورت متن نمایش داده می‌شود.
        </p>

        {EXAMPLES.map((example) => (
          <div key={example.label} className="space-y-1">
            <p className="text-xs font-medium text-foreground">{example.label}</p>
            <div className="space-y-1 rounded-lg bg-muted/60 p-2">
              {example.lines.map((line) => (
                <p
                  key={line}
                  className="text-xs leading-6 text-muted-foreground"
                  dir="rtl"
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}
