import { api, fullName, type ListResponse } from "@/lib/api/client";
import type { PlanKind } from "@/features/athletes/types/athlete-types";
import type {
  Conversation,
  ConversationMessage,
  ConversationPlan,
  MessageThread,
} from "../types/message-types";

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
  const data = await api.get<ListResponse<MessageThreadRow>>("/messages/threads");

  return data.items.map((row) => ({
    counterpartId: row.counterpart_id,
    counterpartRole: row.counterpart_role,
    name: fullName(row.first_name, row.last_name, "کاربر"),
    avatarUrl: row.avatar_url,
    planCount: row.plan_count,
    messageCount: row.message_count,
    unreadCount: row.unread_count,
    lastMessageBody: row.last_message_body,
    lastMessageAuthorId: row.last_message_author_id,
    lastMessageAt: row.last_message_at,
  }));
}

interface ConversationResponse {
  plans: { id: string; kind: PlanKind; title: string; assigned_at: string }[];
  messages: {
    id: string;
    sender_id: string;
    body: string;
    created_at: string;
    plan_kind: PlanKind | null;
    plan_id: string | null;
    plan_title: string | null;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  }[];
}

/**
 * The whole back-and-forth with one person, in one timeline: direct messages
 * and anything written about a plan alike. The shared plans come back with
 * it — they are what the composer can attach a message to, and what names
 * the plan a message was written on.
 */
export async function getConversation(counterpartId: string): Promise<Conversation> {
  const data = await api.get<ConversationResponse>(
    `/messages/conversation/${counterpartId}`
  );

  const plans: ConversationPlan[] = data.plans.map((plan) => ({
    id: plan.id,
    kind: plan.kind,
    title: plan.title,
    assignedAt: plan.assigned_at,
  }));

  const messages: ConversationMessage[] = data.messages.map((row) => ({
    id: row.id,
    planKind: row.plan_kind,
    planId: row.plan_id,
    planTitle: row.plan_title,
    authorId: row.sender_id,
    authorName: fullName(row.first_name, row.last_name, "کاربر"),
    authorAvatarUrl: row.avatar_url,
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
  await api.post("/messages", {
    recipient_id: recipientId,
    body,
    plan_kind: plan?.kind ?? null,
    plan_id: plan?.id ?? null,
  });
}

/**
 * Marks everything this person sent as read. The notifications they produced
 * are cleared in the same call, so the bell doesn't keep announcing a
 * conversation the user is looking at.
 */
export async function markConversationRead(counterpartId: string): Promise<void> {
  await api.post(`/messages/conversation/${counterpartId}/read`);
}
