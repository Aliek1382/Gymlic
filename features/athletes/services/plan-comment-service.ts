import { api, fullName, type ListResponse } from "@/lib/api/client";
import type { PlanComment, PlanKind } from "../types/athlete-types";

// The per-plan thread is a filtered view of the same `messages` table the
// inbox reads (0036): the messages that carry this plan's reference. Writing
// here is writing a message that happens to be about a plan.

interface PlanMessageRow {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

function toPlanComment(row: PlanMessageRow): PlanComment {
  return {
    id: row.id,
    authorId: row.sender_id,
    authorName: fullName(row.first_name, row.last_name, "کاربر"),
    authorAvatarUrl: row.avatar_url,
    body: row.body,
    createdAt: row.created_at,
  };
}

export async function listPlanComments(
  kind: PlanKind,
  assignmentId: string
): Promise<PlanComment[]> {
  const data = await api.get<ListResponse<PlanMessageRow>>(
    `/plans/${kind}/${assignmentId}/comments`
  );
  return data.items.map(toPlanComment);
}

/**
 * The recipient isn't sent: the API derives it from the plan, as whichever
 * of its two sides isn't the person writing.
 */
export async function addPlanComment(
  kind: PlanKind,
  assignmentId: string,
  body: string
): Promise<void> {
  await api.post(`/plans/${kind}/${assignmentId}/comments`, { body });
}
