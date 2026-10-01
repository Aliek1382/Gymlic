"use client";

import { Badge } from "@/components/ui/badge";
import { formatNumber, toPersianDigits } from "@/lib/persian";
import { ExerciseMediaButton } from "@/features/exercises/components/exercise-media";
import type { ContentDetail, ContentKind } from "../services/content-library-service";

const QUESTION_TYPE: Record<string, string> = { text: "متنی", multiple_choice: "چندگزینه‌ای", number: "عددی" };

/** What a template, technique or questionnaire contains — the same view for the trainer and the admin. */
export function ContentPreview({ kind, detail }: { kind: ContentKind; detail: ContentDetail }) {
  return (
    <div className="space-y-4">
      {detail.description && <p className="whitespace-pre-line text-sm text-muted-foreground">{detail.description}</p>}

      {kind === "workout" &&
        (detail.days && detail.days.length > 0 ? (
          <div className="space-y-3">
            {detail.days.map((day) => (
              <div key={day.id} className="rounded-xl border border-border">
                <p className="border-b border-border bg-muted/50 px-3 py-2 text-sm font-medium">
                  {day.day_name?.trim() || `هفته ${toPersianDigits(day.week_number)} — روز ${toPersianDigits(day.day_number)}`}
                </p>
                <ul className="divide-y divide-border">
                  {day.exercises.map((e, i) => (
                    <li key={e.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                      <span className="w-5 text-xs text-muted-foreground">{toPersianDigits(i + 1)}</span>
                      <span className="font-medium text-foreground">{e.exercise_name}</span>
                      <ExerciseMediaButton name={e.exercise_name} media={{ imageUrl: e.image_url ?? null, videoUrl: e.video_url ?? null }} />
                      {e.technique_name && <Badge variant="info">{e.technique_name}</Badge>}
                      <span className="ms-auto text-xs text-muted-foreground">
                        {e.sets != null && `${toPersianDigits(e.sets)} ست`}
                        {e.reps && ` × ${toPersianDigits(e.reps)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">این قالب فقط عنوان و توضیح دارد.</p>
        ))}

      {kind === "nutrition" &&
        (detail.meals && detail.meals.length > 0 ? (
          <div className="space-y-3">
            {detail.meals.map((meal) => (
              <div key={meal.id} className="rounded-xl border border-border">
                <p className="border-b border-border bg-muted/50 px-3 py-2 text-sm font-medium">{meal.meal_name}</p>
                <ul className="divide-y divide-border">
                  {meal.items.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span className="font-medium text-foreground">{item.food_name}</span>
                      <span className="ms-auto text-xs text-muted-foreground">
                        {item.amount != null && formatNumber(item.amount)} {item.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">این قالب فقط عنوان و توضیح دارد.</p>
        ))}

      {kind === "questionnaire" && detail.questions && (
        <ol className="space-y-2">
          {detail.questions.map((q, i) => (
            <li key={q.id} className="rounded-xl border border-border px-3 py-2 text-sm">
              <div className="flex flex-wrap items-start gap-2">
                <span className="text-xs text-muted-foreground">{toPersianDigits(i + 1)}.</span>
                <span className="flex-1 text-foreground">{q.label}</span>
                <Badge variant="secondary">{QUESTION_TYPE[q.type] ?? q.type}</Badge>
                {!q.is_required && <Badge variant="outline">اختیاری</Badge>}
              </div>
              {q.options && q.options.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">{q.options.join(" · ")}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** "۳ روز · ۱۲ حرکت" and the like, for a card. */
export function contentSummary(kind: ContentKind, item: { weeks?: number; days?: number; items?: number }): string {
  const n = (v: number | undefined) => formatNumber(v ?? 0);
  switch (kind) {
    case "workout":
      return (item.days ?? 0) > 0
        ? `${(item.weeks ?? 0) > 1 ? `${n(item.weeks)} هفته · ` : ""}${n(item.days)} روز · ${n(item.items)} حرکت`
        : "عنوان و توضیح";
    case "nutrition":
      return (item.days ?? 0) > 0 ? `${n(item.days)} وعده · ${n(item.items)} قلم غذا` : "عنوان و توضیح";
    case "questionnaire":
      return `${n(item.items)} سؤال`;
    default:
      return "";
  }
}
