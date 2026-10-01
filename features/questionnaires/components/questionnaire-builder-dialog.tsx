"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber, normalizeAmount, toPersianDigits } from "@/lib/persian";
import { MAX_OPTIONS, MAX_QUESTIONS, MIN_OPTIONS, QUESTION_TYPE_LABEL } from "../constants";
import { useSaveQuestionnaire } from "../hooks/use-save-questionnaire";
import type {
  Questionnaire,
  QuestionDraft,
  QuestionType,
  SaveQuestionnaireInput,
} from "../types/questionnaire-types";

let draftCounter = 0;
function newDraft(type: QuestionType = "text"): QuestionDraft {
  draftCounter += 1;
  return {
    key: `draft-${draftCounter}`,
    type,
    label: "",
    options: type === "multiple_choice" ? ["", ""] : [],
    isRequired: true,
  };
}

function draftsFrom(questionnaire?: Questionnaire): QuestionDraft[] {
  if (!questionnaire) return [newDraft()];
  return questionnaire.questions.map((question) => {
    const draft = newDraft(question.type);
    return {
      ...draft,
      label: question.label,
      options: question.options ?? [],
      isRequired: question.isRequired,
    };
  });
}

/**
 * Form builder: the trainer's own questions — free text, multiple choice or a
 * number — in order, with an optional price. Editing a questionnaire that
 * already has responses keeps its questions as they are (the API refuses to
 * replace them, or the submitted answers would go with them).
 */
export function QuestionnaireBuilderDialog({
  open,
  onOpenChange,
  questionnaire,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Set to edit; leave out to create. */
  questionnaire?: Questionnaire;
  /**
   * Saves somewhere other than the trainer's own questionnaires — the admin's
   * public ones (/admin/content). Those are free and never priced, so the
   * price field is left out.
   */
  onSave?: (input: SaveQuestionnaireInput) => Promise<void>;
}) {
  const save = useSaveQuestionnaire();
  const questionsLocked = (questionnaire?.submittedCount ?? 0) > 0;

  const [title, setTitle] = useState(questionnaire?.title ?? "");
  const [description, setDescription] = useState(questionnaire?.description ?? "");
  const [priceText, setPriceText] = useState(
    questionnaire?.priceToman ? String(questionnaire.priceToman) : ""
  );
  const [questions, setQuestions] = useState<QuestionDraft[]>(() => draftsFrom(questionnaire));

  function updateQuestion(key: string, patch: Partial<QuestionDraft>) {
    setQuestions((current) => current.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  }

  function changeType(question: QuestionDraft, type: QuestionType) {
    updateQuestion(question.key, {
      type,
      options: type === "multiple_choice" && question.options.length < MIN_OPTIONS ? ["", ""] : question.options,
    });
  }

  function move(index: number, delta: -1 | 1) {
    setQuestions((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function updateOption(key: string, index: number, value: string) {
    setQuestions((current) =>
      current.map((q) =>
        q.key === key ? { ...q, options: q.options.map((o, i) => (i === index ? value : o)) } : q
      )
    );
  }

  async function handleSubmit() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("عنوان پرسشنامه را وارد کنید.");
      return;
    }

    let priceToman: number | null = null;
    if (priceText.trim() !== "") {
      priceToman = Number(normalizeAmount(priceText));
      if (!Number.isInteger(priceToman) || priceToman < 0) {
        toast.error("قیمت را به‌صورت عدد صحیح (تومان) وارد کنید یا خالی بگذارید.");
        return;
      }
      if (priceToman === 0) priceToman = null;
    }

    let cleaned: QuestionDraft[] | undefined;
    if (!questionsLocked) {
      cleaned = questions.map((q) => ({
        ...q,
        label: q.label.trim(),
        options: q.options.map((o) => o.trim()),
      }));

      for (const [index, q] of cleaned.entries()) {
        const n = toPersianDigits(index + 1);
        if (!q.label) {
          toast.error(`متن سؤال ${n} را وارد کنید.`);
          return;
        }
        if (q.type === "multiple_choice") {
          if (q.options.length < MIN_OPTIONS || q.options.some((o) => !o)) {
            toast.error(`سؤال ${n} حداقل ${toPersianDigits(MIN_OPTIONS)} گزینهٔ پرشده لازم دارد.`);
            return;
          }
          if (new Set(q.options).size !== q.options.length) {
            toast.error(`گزینه‌های سؤال ${n} باید با هم فرق داشته باشند.`);
            return;
          }
        }
      }
    }

    try {
      const input = {
        id: questionnaire?.id,
        title: trimmedTitle,
        description: description.trim() || null,
        priceToman,
        questions: cleaned,
      };
      if (onSave) {
        await onSave(input);
      } else {
        await save.mutateAsync(input);
      }
      toast.success(questionnaire ? "پرسشنامه ذخیره شد." : "پرسشنامه ساخته شد.");
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیرهٔ پرسشنامه با خطا مواجه شد."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{questionnaire ? "ویرایش پرسشنامه" : "پرسشنامهٔ جدید"}</DialogTitle>
          <DialogDescription>
            {onSave
              ? "پرسشنامه‌ای آماده برای همهٔ مربی‌ها؛ هر مربی نسخهٔ خودش را برمی‌دارد و می‌تواند تغییرش دهد."
              : "سؤالات خودتان را بسازید و بعد برای یک یا چند ورزشکار بفرستید."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="questionnaire-title">عنوان</Label>
            <Input
              id="questionnaire-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً پرسشنامهٔ سلامت و سوابق ورزشی"
              maxLength={255}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="questionnaire-description">توضیح (اختیاری)</Label>
            <Input
              id="questionnaire-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ورزشکار بالای فرم این توضیح را می‌بیند"
            />
          </div>

          {!onSave && (
            <div className="space-y-2 rounded-xl border border-border p-3">
              <Label htmlFor="questionnaire-price">تعیین قیمت (اختیاری)</Label>
              <Input
                id="questionnaire-price"
                inputMode="numeric"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                placeholder="خالی = رایگان · مثلاً ۲۰۰٬۰۰۰"
              />
              <p className="text-xs text-muted-foreground">
                با تعیین قیمت، هنگام ارسال برای ورزشکار فاکتور صادر می‌شود و سؤالات تا ثبت پرداخت
                برایش قفل می‌ماند. تغییر قیمت روی فاکتورهای قبلی اثری ندارد.
              </p>
            </div>
          )}

          {questionsLocked ? (
            <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
              این پرسشنامه پاسخ گرفته است، پس سؤالاتش قابل تغییر نیست. برای فرم متفاوت،
              پرسشنامهٔ تازه‌ای بسازید.
            </p>
          ) : (
            <div className="space-y-3">
              {questions.map((question, index) => (
                <div key={question.key} className="space-y-3 rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      سؤال {toPersianDigits(index + 1)}
                    </span>
                    <Select
                      value={question.type}
                      onValueChange={(value) => changeType(question, value as QuestionType)}
                    >
                      <SelectTrigger size="sm" aria-label="نوع سؤال">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(QUESTION_TYPE_LABEL) as QuestionType[]).map((type) => (
                          <SelectItem key={type} value={type}>
                            {QUESTION_TYPE_LABEL[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={question.isRequired}
                        onChange={(e) => updateQuestion(question.key, { isRequired: e.target.checked })}
                      />
                      اجباری
                    </label>
                    <div className="ms-auto flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="بردن سؤال به بالا"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="بردن سؤال به پایین"
                        disabled={index === questions.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="حذف سؤال"
                        disabled={questions.length === 1}
                        onClick={() => setQuestions((current) => current.filter((q) => q.key !== question.key))}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>

                  <Input
                    value={question.label}
                    onChange={(e) => updateQuestion(question.key, { label: e.target.value })}
                    placeholder="متن سؤال"
                    aria-label={`متن سؤال ${toPersianDigits(index + 1)}`}
                    maxLength={500}
                  />

                  {question.type === "multiple_choice" && (
                    <div className="space-y-2">
                      {question.options.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex items-center gap-2">
                          <Input
                            value={option}
                            onChange={(e) => updateOption(question.key, optionIndex, e.target.value)}
                            placeholder={`گزینه ${toPersianDigits(optionIndex + 1)}`}
                            aria-label={`گزینه ${toPersianDigits(optionIndex + 1)}`}
                            maxLength={200}
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label="حذف گزینه"
                            disabled={question.options.length <= MIN_OPTIONS}
                            onClick={() =>
                              updateQuestion(question.key, {
                                options: question.options.filter((_, i) => i !== optionIndex),
                              })
                            }
                          >
                            <X />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={question.options.length >= MAX_OPTIONS}
                        onClick={() => updateQuestion(question.key, { options: [...question.options, ""] })}
                      >
                        <Plus />
                        افزودن گزینه
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                disabled={questions.length >= MAX_QUESTIONS}
                onClick={() => setQuestions((current) => [...current, newDraft()])}
              >
                <Plus />
                افزودن سؤال
              </Button>
              {questions.length >= MAX_QUESTIONS && (
                <p className="text-xs text-muted-foreground">
                  حداکثر {formatNumber(MAX_QUESTIONS)} سؤال.
                </p>
              )}
            </div>
          )}
        </div>

        <Button onClick={handleSubmit} disabled={save.isPending}>
          {save.isPending && <Loader2 className="animate-spin" />}
          {questionnaire ? "ذخیره" : "ساخت پرسشنامه"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
