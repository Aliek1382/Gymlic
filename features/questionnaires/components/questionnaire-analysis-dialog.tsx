"use client";

import { ClipboardList } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { formatNumber, formatPersianDate, toPersianDigits } from "@/lib/persian";
import { useQuestionnaireResponses } from "../hooks/use-questionnaire-responses";
import type { Question, QuestionnaireResponse } from "../types/questionnaire-types";

function answerOf(response: QuestionnaireResponse, question: Question): string | null {
  return response.answers.find((a) => a.questionId === question.id)?.value ?? null;
}

function formatDecimal(value: number): string {
  return toPersianDigits(Number.isInteger(value) ? String(value) : value.toFixed(2));
}

function NumberSummary({ question, responses }: { question: Question; responses: QuestionnaireResponse[] }) {
  const values = responses
    .map((r) => answerOf(r, question))
    .filter((v): v is string => v !== null && v !== "")
    .map(Number)
    .filter(Number.isFinite);

  if (values.length === 0) return <p className="text-sm text-muted-foreground">پاسخی ثبت نشده است.</p>;

  const average = values.reduce((sum, v) => sum + v, 0) / values.length;
  const stats = [
    ["میانگین", average],
    ["کمینه", Math.min(...values)],
    ["بیشینه", Math.max(...values)],
  ] as const;

  return (
    <dl className="flex flex-wrap gap-6 text-sm">
      {stats.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="font-medium text-foreground">{formatDecimal(value)}</dd>
        </div>
      ))}
      <div>
        <dt className="text-xs text-muted-foreground">تعداد پاسخ</dt>
        <dd className="font-medium text-foreground">{formatNumber(values.length)}</dd>
      </div>
    </dl>
  );
}

/** Count per option as a table row with a simple bar — no chart library needed. */
function ChoiceSummary({ question, responses }: { question: Question; responses: QuestionnaireResponse[] }) {
  const answers = responses.map((r) => answerOf(r, question)).filter((v): v is string => !!v);
  const counts = (question.options ?? []).map((option) => ({
    option,
    count: answers.filter((a) => a === option).length,
  }));
  const max = Math.max(1, ...counts.map((c) => c.count));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>گزینه</TableHead>
          <TableHead className="w-1/2">تعداد</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {counts.map(({ option, count }) => (
          <TableRow key={option}>
            <TableCell className="text-foreground">{option}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(count / max) * 100}%` }} />
                </div>
                <span className="w-6 text-end text-xs">{formatNumber(count)}</span>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TextSummary({ question, responses }: { question: Question; responses: QuestionnaireResponse[] }) {
  const rows = responses
    .map((r) => ({ name: r.athleteName, value: answerOf(r, question) }))
    .filter((row) => row.value);

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">پاسخی ثبت نشده است.</p>;

  return (
    <ul className="space-y-1 text-sm">
      {rows.map((row, index) => (
        <li key={index} className="rounded-lg bg-muted/50 px-3 py-2">
          <span className="text-xs text-muted-foreground">{row.name}: </span>
          <span className="whitespace-pre-wrap text-foreground">{row.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Per-questionnaire analysis for the trainer: a summary per question, then every response as a row. */
export function QuestionnaireAnalysisDialog({
  questionnaireId,
  onClose,
}: {
  questionnaireId: string | null;
  onClose: () => void;
}) {
  const result = useQuestionnaireResponses(questionnaireId);
  const data = result.data;

  return (
    <Dialog open={questionnaireId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{data ? `پاسخ‌های «${data.title}»` : "پاسخ‌ها"}</DialogTitle>
          <DialogDescription>
            {data
              ? `${formatNumber(data.responses.length)} پاسخ ثبت شده است.`
              : "خلاصهٔ پاسخ‌ها به‌تفکیک سؤال و جدول پاسخ هر ورزشکار."}
          </DialogDescription>
        </DialogHeader>

        {result.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : result.isError || !data ? (
          <p className="text-sm text-destructive">دریافت پاسخ‌ها با خطا مواجه شد.</p>
        ) : data.responses.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="هنوز پاسخی ثبت نشده است."
            description="بعد از پاسخ ورزشکاران، خلاصه و جدول پاسخ‌ها اینجا می‌آید."
          />
        ) : (
          <div className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-sm font-bold text-foreground">خلاصه</h3>
              {data.questions.map((question, index) => (
                <div key={question.id} className="space-y-2 rounded-xl border border-border p-3">
                  <p className="text-sm font-medium text-foreground">
                    {toPersianDigits(index + 1)}. {question.label}
                  </p>
                  {question.type === "number" && <NumberSummary question={question} responses={data.responses} />}
                  {question.type === "multiple_choice" && (
                    <ChoiceSummary question={question} responses={data.responses} />
                  )}
                  {question.type === "text" && <TextSummary question={question} responses={data.responses} />}
                </div>
              ))}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-bold text-foreground">جدول پاسخ‌ها</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ورزشکار</TableHead>
                      <TableHead>تاریخ</TableHead>
                      {data.questions.map((question, index) => (
                        <TableHead key={question.id}>
                          {toPersianDigits(index + 1)}. {question.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.responses.map((response) => (
                      <TableRow key={response.id}>
                        <TableCell className="text-foreground">{response.athleteName}</TableCell>
                        <TableCell>
                          {formatPersianDate(new Date(response.submittedAt.replace(" ", "T")))}
                        </TableCell>
                        {data.questions.map((question) => (
                          <TableCell key={question.id}>{answerOf(response, question) ?? "—"}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
