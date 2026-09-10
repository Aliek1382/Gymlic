import type { PlanKind } from "@/features/athletes/types/athlete-types";

// A conversation is derived, not stored: two people share one as soon as a
// plan has been assigned between them, and its messages are the
// plan_comments rows on every plan they share (see list_message_threads).
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
// composer, the row a new message gets attached to.
export interface ConversationPlan {
  id: string;
  kind: PlanKind;
  title: string;
  assignedAt: string;
}

export interface ConversationMessage {
  id: string;
  kind: PlanKind;
  assignmentId: string;
  planTitle: string;
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
