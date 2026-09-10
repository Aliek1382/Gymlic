import { createClient } from "@/lib/supabase/client";
import type { PlanComment, PlanKind } from "../types/athlete-types";

// The per-plan thread is a filtered view of the same `messages` table the
// inbox reads (0036): the messages that carry this plan's reference. Writing
// here is writing a message that happens to be about a plan.
const TABLE_BY_KIND = {
  workout: "workout_assignments",
  nutrition: "nutrition_assignments",
} as const;

interface PlanMessageRow {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
}

function toPlanComment(row: PlanMessageRow): PlanComment {
  return {
    id: row.id,
    authorId: row.sender_id,
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
    .from("messages")
    .select(
      "id, sender_id, body, created_at, profiles!sender_id(first_name, last_name, avatar_url)"
    )
    .eq("plan_kind", kind)
    .eq("plan_id", assignmentId)
    .order("created_at", { ascending: true })
    .returns<PlanMessageRow[]>();
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

  // A message names its recipient, which the plan itself supplies: whichever
  // of its two sides isn't the person writing.
  const { data: plan, error: planError } = await supabase
    .from(TABLE_BY_KIND[kind])
    .select("trainer_id, athlete_id")
    .eq("id", assignmentId)
    .maybeSingle();
  if (planError) throw planError;
  if (!plan?.athlete_id) throw new Error("این برنامه هنوز به ورزشکاری اختصاص نیافته است.");

  const recipientId = plan.trainer_id === user.id ? plan.athlete_id : plan.trainer_id;
  if (recipientId === user.id) {
    throw new Error("امکان ارسال پیام به خودتان وجود ندارد.");
  }

  const { error } = await supabase.from("messages").insert({
    sender_id: user.id,
    recipient_id: recipientId,
    body,
    plan_kind: kind,
    plan_id: assignmentId,
  });
  if (error) throw error;
}
