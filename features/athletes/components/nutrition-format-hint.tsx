"use client";

import { CollapsibleSection } from "@/components/ui/collapsible-section";

// The nutrition counterpart of PlanFormatHint: what a trainer typing into
// the description box can write and still get a formatted table instead of
// a plain paragraph.
const EXAMPLES: { label: string; lines: string[] }[] = [
  {
    label: "غذا و مقدار — هر سه شکل یک نتیجه می‌دهند",
    lines: ["سینه مرغ — 150 گرم", "سینه مرغ: 150 گرم", "سینه مرغ 150 گرم"],
  },
  {
    label: "توضیح — داخل پرانتز، در انتهای همان خط",
    lines: ["سینه مرغ — 150 گرم (آب‌پز)", "پودر پروتئین وی — 1 اسکوپ (بعد از تمرین)"],
  },
  {
    label: "واحد دلخواه — بعد از خط تیره یا دونقطه هر واحدی مجاز است",
    lines: ["جو دوسر — 50 گرم", "شیر کم‌چرب — 1 لیوان", "خرما — 3 عدد"],
  },
  {
    label: "وعده غذایی — یک خط جدا که به «:» ختم شود",
    lines: ["صبحانه:", "بعد از تمرین:"],
  },
];

export function NutritionFormatHint() {
  return (
    <CollapsibleSection title="راهنمای نوشتن دستی (اختیاری)">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          اگر مستقیم تایپ می‌کنید، نوشتن به هر یک از شکل‌های زیر باعث می‌شود آن
          خط به‌صورت جدول نمایش داده شود. اعشار و کسر (مثل ۱٫۵ یا ۱/۲) و ارقام
          فارسی هم پذیرفته می‌شوند. هر خطی که با این شکل‌ها نخواند، دست‌نخورده
          به‌صورت متن نمایش داده می‌شود.
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
