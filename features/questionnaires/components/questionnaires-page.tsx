"use client";

import { useState } from "react";
import { BarChart3, ClipboardList, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleGate } from "@/features/authentication/components/role-gate";
import { useAuthContext } from "@/features/authentication/hooks/use-auth-context";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber } from "@/lib/persian";
import { useDeleteQuestionnaire } from "../hooks/use-delete-questionnaire";
import { useQuestionnaires } from "../hooks/use-questionnaires";
import { useSetQuestionnaireActive } from "../hooks/use-set-questionnaire-active";
import type { Questionnaire } from "../types/questionnaire-types";
import { AssignQuestionnaireDialog } from "./assign-questionnaire-dialog";
import { MyQuestionnairesPage } from "./my-questionnaires-page";
import { PendingQuestionnaireInvoices } from "./pending-questionnaire-invoices";
import { QuestionnaireAnalysisDialog } from "./questionnaire-analysis-dialog";
import { QuestionnaireBuilderDialog } from "./questionnaire-builder-dialog";

/** /questionnaires: the trainer builds and reads them, the athlete answers them. */
export function QuestionnairesPage() {
  const { data: context } = useAuthContext();

  return (
    <RoleGate allow={["trainer", "athlete"]}>
      {context?.accountType === "athlete" ? <MyQuestionnairesPage /> : <TrainerQuestionnaires />}
    </RoleGate>
  );
}

function TrainerQuestionnaires() {
  const questionnaires = useQuestionnaires();
  const setActive = useSetQuestionnaireActive();
  const deleteQuestionnaire = useDeleteQuestionnaire();

  // `builder` is 'new' or the questionnaire being edited; the key remounts the form per target.
  const [builder, setBuilder] = useState<Questionnaire | "new" | null>(null);
  const [assigning, setAssigning] = useState<Questionnaire | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Questionnaire | null>(null);

  async function toggleActive(questionnaire: Questionnaire) {
    try {
      await setActive.mutateAsync({ id: questionnaire.id, isActive: !questionnaire.isActive });
    } catch (error) {
      toast.error(getErrorMessage(error, "تغییر وضعیت با خطا مواجه شد."));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">پرسشنامه‌ها</h1>
          <p className="text-sm text-muted-foreground">
            فرم دلخواه خودتان را با سؤال متنی، چندگزینه‌ای و عددی بسازید، برای ورزشکاران بفرستید و پاسخ‌ها را ببینید.
          </p>
        </div>
        <Button onClick={() => setBuilder("new")}>
          <Plus />
          پرسشنامهٔ جدید
        </Button>
      </div>

      <PendingQuestionnaireInvoices />

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
            title="هنوز پرسشنامه‌ای نساخته‌اید."
            description="با دکمهٔ «پرسشنامهٔ جدید» اولین فرم را بسازید."
          />
        </Card>
      ) : (
        questionnaires.data.map((questionnaire) => (
          <Card key={questionnaire.id} className="gap-3 py-5">
            <div className="flex flex-wrap items-start justify-between gap-2 px-6">
              <div>
                <p className="font-medium text-foreground">{questionnaire.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(questionnaire.questions.length)} سؤال ·{" "}
                  {questionnaire.priceToman
                    ? `${formatNumber(questionnaire.priceToman)} تومان`
                    : "رایگان"}{" "}
                  · ارسال‌شده: {formatNumber(questionnaire.assignedCount)} · پاسخ‌داده:{" "}
                  {formatNumber(questionnaire.submittedCount)}
                </p>
              </div>
              <Badge variant={questionnaire.isActive ? "success" : "secondary"}>
                {questionnaire.isActive ? "فعال" : "غیرفعال"}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2 px-6">
              <Button
                size="sm"
                disabled={!questionnaire.isActive}
                onClick={() => setAssigning(questionnaire)}
              >
                <Send />
                ارسال به ورزشکار
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAnalysisId(questionnaire.id)}>
                <BarChart3 />
                پاسخ‌ها و تحلیل
              </Button>
              <Button size="sm" variant="outline" onClick={() => setBuilder(questionnaire)}>
                <Pencil />
                ویرایش
              </Button>
              <Button size="sm" variant="outline" onClick={() => toggleActive(questionnaire)}>
                {questionnaire.isActive ? "غیرفعال‌کردن" : "فعال‌کردن"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleting(questionnaire)}>
                <Trash2 />
                حذف
              </Button>
            </div>
          </Card>
        ))
      )}

      {builder !== null && (
        <QuestionnaireBuilderDialog
          key={builder === "new" ? "new" : builder.id}
          open
          onOpenChange={(open) => !open && setBuilder(null)}
          questionnaire={builder === "new" ? undefined : builder}
        />
      )}

      <AssignQuestionnaireDialog
        questionnaire={assigning}
        onOpenChange={(open) => !open && setAssigning(null)}
      />

      <QuestionnaireAnalysisDialog questionnaireId={analysisId} onClose={() => setAnalysisId(null)} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="حذف پرسشنامه"
        description="پرسشنامه و ارسال‌های بی‌پاسخ آن حذف می‌شود. پرسشنامه‌ای که پاسخ گرفته حذف نمی‌شود؛ آن را غیرفعال کنید."
        confirmLabel="حذف"
        errorMessage="حذف پرسشنامه با خطا مواجه شد."
        onConfirm={async () => {
          if (!deleting) return;
          await deleteQuestionnaire.mutateAsync(deleting.id);
          toast.success("پرسشنامه حذف شد.");
        }}
      />
    </div>
  );
}
