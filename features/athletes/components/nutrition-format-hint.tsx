"use client";

import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { FOOD_UNITS } from "@/features/foods/constants/foods";

// The nutrition counterpart of PlanFormatHint: what a trainer typing into
// the description box can write and still get a formatted table instead of
// a plain paragraph. Every shape here is one nutrition-plan-parse actually
// accepts — the two of them are meant to be read side by side.
const EXAMPLES: { label: string; lines: string[]; note?: string }[] = [
  {
    label: "غذا و مقدار — با خط تیره یا دونقطه، هر واحدی مجاز است",
    lines: [
      "سینه مرغ — 150 گرم",
      "برنج: 200 گرم",
      "مکمل — 1 پیمانه سرصاف",
      "تخم‌مرغ — 3",
    ],
    note: "واحد اختیاری است؛ اگر ننویسید فقط مقدار نمایش داده می‌شود.",
  },
  {
    label: "بدون خط تیره — فقط با واحدهای استاندارد",
    lines: ["شیر کم‌چرب 1 لیوان", "نان سنگک 2 برش"],
    note: `در این حالت واحد باید یکی از این‌ها باشد و خط باید با آن تمام شود: ${FOOD_UNITS.join("، ")}.`,
  },
  {
    label: "بازه مقدار — هر دو شکل یک نتیجه می‌دهند",
    lines: ["برنج — 100-150 گرم", "برنج — 100 تا 150 گرم"],
  },
  {
    label: "توضیح — داخل پرانتز، در انتهای همان خط",
    lines: ["سینه مرغ — 150 گرم (آب‌پز)", "پودر پروتئین وی — 1 اسکوپ (بعد از تمرین)"],
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
          اگر مستقیم تایپ می‌کنید، هر ماده غذایی را در یک خط جدا بنویسید. نوشتن
          به هر یک از شکل‌های زیر باعث می‌شود آن خط به‌صورت جدول نمایش داده
          شود. اعشار و کسر (مثل ۱٫۵ یا ۱/۲) و ارقام فارسی هم پذیرفته می‌شوند.
          هر خطی که با این شکل‌ها نخواند، دست‌نخورده به‌صورت متن نمایش داده
          می‌شود.
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
            {example.note && (
              <p className="text-xs leading-6 text-muted-foreground">
                {example.note}
              </p>
            )}
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}
