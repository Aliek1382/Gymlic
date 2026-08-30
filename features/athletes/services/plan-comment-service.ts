import { createClient } from "@/lib/supabase/client";
import type { PlanComment, PlanKind } from "../types/athlete-types";

interface PlanCommentRow {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
}

function toPlanComment(row: PlanCommentRow): PlanComment {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName:
      [row.profiles?.first_name, row.profiles?.last_name].filter(Boolean).join(" ") ||
      "کاربر",
    authorAvatarUrl: row.profiles?.avatar_url ?? null,
    body: row.body,
    createdAt: row.created_at,
  };
}

export async function listPlanComments(
  kind: PlanKind,
  assignmentId: string
): Promise<PlanComment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("plan_comments")
    .select("id, author_id, body, created_at, profiles!author_id(first_name, last_name, avatar_url)")
    .eq("kind", kind)
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: true })
    .returns<PlanCommentRow[]>();
  if (error) throw error;

  return (data ?? []).map(toPlanComment);
}

export async function addPlanComment(
  kind: PlanKind,
  assignmentId: string,
  body: string
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("نشست کاربر معتبر نیست.");

  const { error } = await supabase.from("plan_comments").insert({
    kind,
    assignment_id: assignmentId,
    author_id: user.id,
    body,
  });
  if (error) throw error;
}
