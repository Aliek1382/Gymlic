"use client";

import { ClipboardList } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { LockedPlanCard } from "@/features/invoices/components/locked-plan-card";
import { formatPersianDate } from "@/lib/persian";
import { useMyQuestionnaires } from "../hooks/use-my-questionnaires";
import { QuestionnaireFillForm } from "./questionnaire-fill-form";

/** The athlete's questionnaires: locked behind an unpaid invoice, waiting for answers, or already answered. */
export function MyQuestionnairesPage() {
  const questionnaires = useMyQuestionnaires();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">پرسشنامه‌ها</h1>
        <p className="text-sm text-muted-foreground">پرسشنامه‌هایی که مربی برای شما فرستاده است.</p>
      </div>

      {questionnaires.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : questionnaires.isError ? (
        <Card className="border-destructive/30 py-5">
          <p className="px-6 text-sm text-destructive">
            دریافت پرسشنامه‌ها با خطا مواجه شد. صفحه را دوباره بارگذاری کنید.
          </p>
        </Card>
      ) : !questionnaires.data || questionnaires.data.length === 0 ? (
        <Card className="py-5">
          <EmptyState
            icon={ClipboardList}
            title="هنوز پرسشنامه‌ای ندارید."
            description="به محض ارسال پرسشنامه توسط مربی، اینجا نمایش داده می‌شود."
          />
        </Card>
      ) : (
        questionnaires.data.map((questionnaire) => (
          <Card key={questionnaire.id} className="gap-4 py-5">
            <div className="flex flex-wrap items-center justify-between gap-2 px-6">
              <div>
                <p className="font-medium text-foreground">{questionnaire.title}</p>
                <p className="text-xs text-muted-foreground">
                  مربی: {questionnaire.trainerName}
                  {questionnaire.submittedAt &&
                    ` · پاسخ شما: ${formatPersianDate(new Date(questionnaire.submittedAt.replace(" ", "T")))}`}
                </p>
              </div>
              <Badge variant={questionnaire.status === "submitted" ? "success" : "warning"}>
                {questionnaire.status === "submitted" ? "پاسخ داده شد" : "منتظر پاسخ"}
              </Badge>
            </div>

            <div className="px-6">
              {questionnaire.locked && questionnaire.invoice ? (
                <LockedPlanCard invoice={questionnaire.invoice} subject="پرسشنامه" />
              ) : (
                <QuestionnaireFillForm questionnaire={questionnaire} />
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
