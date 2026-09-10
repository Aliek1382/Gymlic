"use client";

import { useState } from "react";
import { Apple, Dumbbell, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getErrorMessage } from "@/lib/get-error-message";
import type { PlanKind } from "@/features/athletes/types/athlete-types";
import type { ConversationPlan } from "../types/message-types";

// Same ceiling the plan_comments body check enforces in the database.
const MAX_MESSAGE_LENGTH = 500;

const PLAN_ICON = { workout: Dumbbell, nutrition: Apple } as const;

function planKey(plan: ConversationPlan) {
  return `${plan.kind}:${plan.id}`;
}

/**
 * Every message belongs to one of the plans the two share — that's what
 * plan_comments records — so the composer picks one. It defaults to the
 * most recently assigned plan, which is what a message is nearly always
 * about, and the picker is only shown when there's more than one to choose
 * from.
 */
export function MessageComposer({
  plans,
  isPending,
  onSend,
}: {
  plans: ConversationPlan[];
  isPending: boolean;
  onSend: (input: { kind: PlanKind; assignmentId: string; body: string }) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [selectedKey, setSelectedKey] = useState(() => planKey(plans[0]));

  const selectedPlan = plans.find((plan) => planKey(plan) === selectedKey) ?? plans[0];

  async function handleSubmit() {
    const body = draft.trim();
    if (!body || isPending) return;

    try {
      await onSend({ kind: selectedPlan.kind, assignmentId: selectedPlan.id, body });
      setDraft("");
    } catch (error) {
      toast.error(getErrorMessage(error, "ارسال پیام با خطا مواجه شد."));
    }
  }

  return (
    <div className="space-y-2 border-t border-border p-3">
      {plans.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">درباره برنامه:</span>
          <Select value={planKey(selectedPlan)} onValueChange={setSelectedKey}>
            <SelectTrigger className="h-9 flex-1 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {plans.map((plan) => {
                const Icon = PLAN_ICON[plan.kind];
                return (
                  <SelectItem key={planKey(plan)} value={planKey(plan)}>
                    <Icon className="size-3.5" />
                    {plan.title}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSubmit();
            }
          }}
          rows={2}
          placeholder="پیامتان را بنویسید..."
          className="flex-1 resize-none rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
        />
        <Button
          type="button"
          size="icon"
          disabled={isPending || !draft.trim()}
          onClick={handleSubmit}
          aria-label="ارسال پیام"
        >
          {isPending ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </div>
    </div>
  );
}
