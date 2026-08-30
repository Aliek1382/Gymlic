"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/lib/persian";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";
import { useAddPlanComment } from "../hooks/use-add-plan-comment";
import { usePlanComments } from "../hooks/use-plan-comments";
import type { PlanKind } from "../types/athlete-types";

const MAX_COMMENT_LENGTH = 500;

// A small back-and-forth thread on one assigned plan — the athlete can flag
// something ("این حرکت برام سخت بود") and the trainer can reply, right
// where the plan itself is shown. Each new comment also fires a
// notification to whoever didn't write it (see notify_plan_comment).
export function PlanComments({
  kind,
  assignmentId,
  currentUserId,
}: {
  kind: PlanKind;
  assignmentId: string;
  currentUserId: string;
}) {
  const [draft, setDraft] = useState("");
  const comments = usePlanComments(kind, assignmentId);
  const addComment = useAddPlanComment(kind, assignmentId);

  async function handleSubmit() {
    const body = draft.trim();
    if (!body) return;
    try {
      await addComment.mutateAsync(body);
      setDraft("");
    } catch (error) {
      toast.error(getErrorMessage(error, "ثبت نظر با خطا مواجه شد."));
    }
  }

  return (
    <div className="space-y-3">
      {comments.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-3/4" />
        </div>
      ) : !comments.data || comments.data.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          هنوز نظری ثبت نشده — اگر نکته‌ای درباره این برنامه هست، اینجا بنویسید.
        </p>
      ) : (
        <ul className="space-y-2">
          {comments.data.map((comment) => {
            const isOwn = comment.authorId === currentUserId;
            return (
              <li
                key={comment.id}
                className={cn("flex items-start gap-2", isOwn && "flex-row-reverse")}
              >
                <Avatar className="size-7 shrink-0">
                  <AvatarImage src={comment.authorAvatarUrl ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {comment.authorName.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    "min-w-0 max-w-[85%] space-y-0.5 rounded-xl px-3 py-2 text-sm",
                    isOwn ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-baseline gap-2 text-[11px]",
                      isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}
                  >
                    <span className="font-medium">{comment.authorName}</span>
                    <span>{formatRelativeTime(new Date(comment.createdAt))}</span>
                  </div>
                  <p className="whitespace-pre-line break-words">{comment.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          rows={2}
          placeholder="نظرتون رو درباره این برنامه بنویسید..."
          className="flex-1 resize-none rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
        />
        <Button
          type="button"
          size="icon"
          disabled={addComment.isPending || !draft.trim()}
          onClick={handleSubmit}
          aria-label="ارسال نظر"
        >
          {addComment.isPending ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </div>
    </div>
  );
}
