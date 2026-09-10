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

interface ConversationMessageRow {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  plan_kind: PlanKind | null;
  plan_id: string | null;
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
 * The whole back-and-forth with one person, in one timeline: direct messages
 * and anything written about a plan alike. The shared plans come back with
 * it — they are what the composer can attach a message to, and what names
 * the plan a message was written on.
 */
export async function getConversation(counterpartId: string): Promise<Conversation> {
  const supabase = createClient();
  const userId = await getCurrentUserId();

  const [workoutPlans, nutritionPlans, conversation] = await Promise.all([
    listSharedPlans("workout", userId, counterpartId),
    listSharedPlans("nutrition", userId, counterpartId),
    supabase
      .from("messages")
      .select(
        "id, sender_id, body, created_at, plan_kind, plan_id, profiles!sender_id(first_name, last_name, avatar_url)"
      )
      // Both directions of the pair. RLS already limits this to the caller's
      // own messages, so this only has to pick the counterpart.
      .or(
        `and(sender_id.eq.${userId},recipient_id.eq.${counterpartId}),` +
          `and(sender_id.eq.${counterpartId},recipient_id.eq.${userId})`
      )
      .order("created_at", { ascending: true })
      .returns<ConversationMessageRow[]>(),
  ]);
  if (conversation.error) throw conversation.error;

  const plans = [...workoutPlans, ...nutritionPlans].sort((a, b) =>
    b.assignedAt.localeCompare(a.assignedAt)
  );

  // plan_id has no single FK (workout and nutrition plans live in separate
  // tables), so a title is looked up by kind and id together.
  const planByKey = new Map(plans.map((plan) => [`${plan.kind}:${plan.id}`, plan]));

  const messages: ConversationMessage[] = (conversation.data ?? []).map((row) => ({
    id: row.id,
    planKind: row.plan_kind,
    planId: row.plan_id,
    planTitle:
      row.plan_id && row.plan_kind
        ? planByKey.get(`${row.plan_kind}:${row.plan_id}`)?.title ?? "برنامه"
        : null,
    authorId: row.sender_id,
    authorName: fullName(row.profiles?.first_name ?? null, row.profiles?.last_name ?? null),
    authorAvatarUrl: row.profiles?.avatar_url ?? null,
    body: row.body,
    createdAt: row.created_at,
  }));

  return { plans, messages };
}

/**
 * Sends one message. `plan` is optional: without it this is an ordinary
 * direct message, which is what makes a conversation possible before any
 * plan exists.
 */
export async function sendMessage(
  recipientId: string,
  body: string,
  plan?: { kind: PlanKind; id: string } | null
): Promise<void> {
  const supabase = createClient();
  const userId = await getCurrentUserId();

  const { error } = await supabase.from("messages").insert({
    sender_id: userId,
    recipient_id: recipientId,
    body,
    plan_kind: plan?.kind ?? null,
    plan_id: plan?.id ?? null,
  });
  if (error) throw error;
}

/**
 * Marks everything this person sent as read. The unread count comes from the
 * messages themselves now, but the notifications they produced are cleared
 * in the same breath so the bell doesn't keep announcing a conversation the
 * user is looking at. 'plan_comment' is included for rows written before
 * 0036 renamed the kind.
 */
export async function markConversationRead(counterpartId: string): Promise<void> {
  const supabase = createClient();
  const userId = await getCurrentUserId();
  const readAt = new Date().toISOString();

  const [messagesResult, notificationsResult] = await Promise.all([
    supabase
      .from("messages")
      .update({ read_at: readAt })
      .eq("recipient_id", userId)
      .eq("sender_id", counterpartId)
      .is("read_at", null),
    supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("recipient_id", userId)
      .in("type", ["message", "plan_comment"])
      .eq("actor_id", counterpartId)
      .is("read_at", null),
  ]);
  if (messagesResult.error) throw messagesResult.error;
  if (notificationsResult.error) throw notificationsResult.error;
}
