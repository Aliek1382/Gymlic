"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/get-error-message";
import { toAsciiDigits, toPersianDigits } from "@/lib/persian";
import { useSubmitQuestionnaire } from "../hooks/use-submit-questionnaire";
import type { MyQuestionnaire, Question } from "../types/questionnaire-types";

/**
 * Renders the questions by type. Once answered it shows the athlete's own
 * answers read-only — the API takes a questionnaire's answers only once.
 */
export function QuestionnaireFillForm({ questionnaire }: { questionnaire: MyQuestionnaire }) {
  const submit = useSubmitQuestionnaire();
  const submitted = questionnaire.status === "submitted";
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(questionnaire.answers.map((a) => [a.questionId, a.value ?? ""]))
  );

  const set = (questionId: string, value: string) =>
    setValues((current) => ({ ...current, [questionId]: value }));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const answers = questionnaire.questions.map((question) => {
      const raw = (values[question.id] ?? "").trim();
      return {
        questionId: question.id,
        value: question.type === "number" ? toAsciiDigits(raw).replace(/٫/g, ".") : raw,
      };
    });

    for (const [index, question] of questionnaire.questions.entries()) {
      const value = answers[index].value;
      if (question.isRequired && !value) {
        toast.error(`به سؤال ${toPersianDigits(index + 1)} پاسخ دهید.`);
        return;
      }
      if (question.type === "number" && value && !Number.isFinite(Number(value))) {
        toast.error(`پاسخ سؤال ${toPersianDigits(index + 1)} باید عدد باشد.`);
        return;
      }
    }

    try {
      await submit.mutateAsync({ responseId: questionnaire.id, answers });
      toast.success("پاسخ‌های شما ثبت شد.");
    } catch (error) {
      toast.error(getErrorMessage(error, "ثبت پاسخ با خطا مواجه شد."));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {questionnaire.description && (
        <p className="text-sm text-muted-foreground">{questionnaire.description}</p>
      )}

      {questionnaire.questions.map((question, index) => (
        <fieldset key={question.id} disabled={submitted} className="space-y-2">
          <legend className="text-sm font-medium text-foreground">
            {toPersianDigits(index + 1)}. {question.label}
            {question.isRequired && <span className="text-destructive"> *</span>}
          </legend>
          <QuestionField
            question={question}
            value={values[question.id] ?? ""}
            onChange={(value) => set(question.id, value)}
          />
        </fieldset>
      ))}

      {!submitted && (
        <Button type="submit" disabled={submit.isPending}>
          {submit.isPending && <Loader2 className="animate-spin" />}
          ثبت پاسخ‌ها
        </Button>
      )}
    </form>
  );
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: string;
  onChange: (value: string) => void;
}) {
  if (question.type === "multiple_choice") {
    return (
      <div className="space-y-1.5">
        {(question.options ?? []).map((option) => (
          <label key={option} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={question.id}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            {option}
          </label>
        ))}
      </div>
    );
  }

  return (
    <Input
      inputMode={question.type === "number" ? "decimal" : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={question.type === "number" ? "عدد" : "پاسخ شما"}
      aria-label={question.label}
    />
  );
}
