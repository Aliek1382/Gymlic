import type { PlanKind } from "@/features/athletes/types/athlete-types";

// A conversation is derived, not stored: it exists between any two people
// the trainer/athlete relationship (or a shared plan) links, and its
// messages are the `messages` rows between them — see list_message_threads.
// Someone you have never written to still gets a thread, which is how a
// first message is sent.
export interface MessageThread {
  counterpartId: string;
  // The other side's role relative to the viewer — an athlete's threads are
  // all with trainers, a trainer's all with athletes.
  counterpartRole: "trainer" | "athlete";
  name: string;
  avatarUrl: string | null;
  planCount: number;
  messageCount: number;
  unreadCount: number;
  lastMessageBody: string | null;
  lastMessageAuthorId: string | null;
  lastMessageAt: string | null;
}

// One plan the two of them share — both a thing to talk about and, for the
// composer, what an outgoing message can optionally be attached to.
export interface ConversationPlan {
  id: string;
  kind: PlanKind;
  title: string;
  assignedAt: string;
}

export interface ConversationMessage {
  id: string;
  // Null on a plain direct message; set when it was written about a plan.
  planKind: PlanKind | null;
  planId: string | null;
  planTitle: string | null;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
}

export interface Conversation {
  plans: ConversationPlan[];
  messages: ConversationMessage[];
}
