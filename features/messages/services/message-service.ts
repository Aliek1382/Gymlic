import { createClient } from "@/lib/supabase/client";
import type { PlanKind } from "@/features/athletes/types/athlete-types";
import type {
  Conversation,
  ConversationMessage,
  ConversationPlan,
  MessageThread,
} from "../types/message-types";

const TABLE_BY_KIND = {
  workout: "workout_assignments",
  nutrition: "nutrition_assignments",
} as const;

async function getCurrentUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("نشست کاربر معتبر نیست.");
  return user.id;
}

function fullName(first: string | null, last: string | null): string {
  return [first, last].filter(Boolean).join(" ") || "کاربر";
}

interface MessageThreadRow {
  counterpart_id: string;
  counterpart_role: "trainer" | "athlete";
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  plan_count: number;
  message_count: number;
  unread_count: number;
  last_message_body: string | null;
  last_message_author_id: string | null;
  last_message_at: string | null;
}

/** Everyone the current user can message, newest conversation first. */
export async function listMessageThreads(): Promise<MessageThread[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc("list_message_threads")
    .returns<MessageThreadRow[]>();
  if (error) throw error;

  return (data ?? []).map((row) => ({
    counterpartId: row.counterpart_id,
    counterpartRole: row.counterpart_role,
    name: fullName(row.first_name, row.last_name),
    avatarUrl: row.avatar_url,
    planCount: row.plan_count,
    messageCount: row.message_count,
    unreadCount: row.unread_count,
    lastMessageBody: row.last_message_body,
    lastMessageAuthorId: row.last_message_author_id,
    lastMessageAt: row.last_message_at,
  }));
}

interface AssignmentRow {
  id: string;
  title: string;
  assigned_at: string;
}

interface ConversationCommentRow {
  id: string;
  kind: PlanKind;
  assignment_id: string;
  author_id: string;
  body: string;
  created_at: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
}

async function listSharedPlans(
  kind: PlanKind,
  userId: string,
  counterpartId: string
): Promise<ConversationPlan[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE_BY_KIND[kind])
    .select("id, title, assigned_at")
    // Either direction of the pair — whichever of the two is the trainer.
    // Drafts and templates are excluded for the same reason as in
    // list_message_threads: the athlete has never seen them.
    .or(
      `and(trainer_id.eq.${userId},athlete_id.eq.${counterpartId}),` +
        `and(trainer_id.eq.${counterpartId},athlete_id.eq.${userId})`
    )
    .eq("is_template", false)
    .neq("status", "draft")
    .order("assigned_at", { ascending: false })
    .returns<AssignmentRow[]>();
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    kind,
    title: row.title,
    assignedAt: row.assigned_at,
  }));
}

/**
 * The whole back-and-forth with one person: every comment on every plan
 * they share, merged into a single timeline. Each message keeps the plan it
 * was written on, so the thread can still say what a line is about.
 */
export async function getConversation(counterpartId: string): Promise<Conversation> {
  const supabase = createClient();
  const userId = await getCurrentUserId();

  const [workoutPlans, nutritionPlans] = await Promise.all([
    listSharedPlans("workout", userId, counterpartId),
    listSharedPlans("nutrition", userId, counterpartId),
  ]);

  const plans = [...workoutPlans, ...nutritionPlans].sort((a, b) =>
    b.assignedAt.localeCompare(a.assignedAt)
  );
  if (plans.length === 0) return { plans, messages: [] };

  const { data, error } = await supabase
    .from("plan_comments")
    .select(
      "id, kind, assignment_id, author_id, body, created_at, profiles!author_id(first_name, last_name, avatar_url)"
    )
    .in(
      "assignment_id",
      plans.map((plan) => plan.id)
    )
    .order("created_at", { ascending: true })
    .returns<ConversationCommentRow[]>();
  if (error) throw error;

  // assignment_id has no single FK (workout and nutrition plans live in
  // separate tables), so the id filter above can't tell the two apart on
  // its own — the kind has to match the plan the id was taken from.
  const planByKey = new Map(plans.map((plan) => [`${plan.kind}:${plan.id}`, plan]));

  const messages: ConversationMessage[] = [];
  for (const row of data ?? []) {
    const plan = planByKey.get(`${row.kind}:${row.assignment_id}`);
    if (!plan) continue;
    messages.push({
      id: row.id,
      kind: row.kind,
      assignmentId: row.assignment_id,
      planTitle: plan.title,
      authorId: row.author_id,
      authorName: fullName(row.profiles?.first_name ?? null, row.profiles?.last_name ?? null),
      authorAvatarUrl: row.profiles?.avatar_url ?? null,
      body: row.body,
      createdAt: row.created_at,
    });
  }

  return { plans, messages };
}

/**
 * Clears the unread badge for one conversation by marking the notifications
 * it produced as read — the same rows the bell reads, so opening a
 * conversation empties both at once.
 */
export async function markConversationRead(counterpartId: string): Promise<void> {
  const supabase = createClient();
  const userId = await getCurrentUserId();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", userId)
    .eq("type", "plan_comment")
    .eq("actor_id", counterpartId)
    .is("read_at", null);
  if (error) throw error;
}
