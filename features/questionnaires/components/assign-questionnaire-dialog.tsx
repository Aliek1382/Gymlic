"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAthletes } from "@/features/athletes/hooks/use-athletes";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber, toPersianDigits } from "@/lib/persian";
import { useAssignQuestionnaire } from "../hooks/use-assign-questionnaire";
import type { Questionnaire } from "../types/questionnaire-types";

/** Sends a questionnaire to one or more athletes on the trainer's roster. */
export function AssignQuestionnaireDialog({
  questionnaire,
  onOpenChange,
}: {
  /** The questionnaire being sent; null keeps the dialog closed. */
  questionnaire: Questionnaire | null;
  onOpenChange: (open: boolean) => void;
}) {
  const athletes = useAthletes({ enabled: questionnaire !== null });
  const assign = useAssignQuestionnaire();
  const [selected, setSelected] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  }

  function close(open: boolean) {
    if (!open) setSelected([]);
    onOpenChange(open);
  }

  async function handleSend() {
    if (!questionnaire || selected.length === 0) return;

    setSending(true);
    let sent = 0;
    const failures: string[] = [];
    // One by one: each send is its own invoice + notification, and one failure
    // (say, already sent to that athlete) must not stop the rest.
    for (const athleteId of selected) {
      try {
        await assign.mutateAsync({ questionnaireId: questionnaire.id, athleteId });
        sent += 1;
      } catch (error) {
        const name = athletes.data?.find((a) => a.id === athleteId)?.name ?? "ورزشکار";
        failures.push(`${name}: ${getErrorMessage(error, "ارسال ناموفق بود.")}`);
      }
    }
    setSending(false);

    if (sent > 0) toast.success(`پرسشنامه برای ${formatNumber(sent)} ورزشکار ارسال شد.`);
    failures.forEach((message) => toast.error(message));
    if (failures.length === 0) close(false);
    else setSelected([]);
  }

  return (
    <Dialog open={questionnaire !== null} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ارسال به ورزشکار</DialogTitle>
          <DialogDescription>
            {questionnaire?.priceToman
              ? `برای هر ورزشکار فاکتوری به مبلغ ${formatNumber(questionnaire.priceToman)} تومان صادر می‌شود و سؤالات تا ثبت پرداخت قفل می‌ماند.`
              : "ورزشکاران انتخاب‌شده اعلان می‌گیرند و می‌توانند پاسخ دهند."}
          </DialogDescription>
        </DialogHeader>

        {athletes.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !athletes.data || athletes.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">هنوز ورزشکاری ندارید.</p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {athletes.data.map((athlete) => (
              <li key={athlete.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={selected.includes(athlete.id)}
                    onChange={() => toggle(athlete.id)}
                  />
                  {athlete.name}
                </label>
              </li>
            ))}
          </ul>
        )}

        <Button onClick={handleSend} disabled={sending || selected.length === 0}>
          {sending ? <Loader2 className="animate-spin" /> : <Send />}
          ارسال{selected.length > 0 && ` به ${toPersianDigits(selected.length)} نفر`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
