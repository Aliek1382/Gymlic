import type { PlanKind } from "@/features/athletes/types/athlete-types";

// A conversation is derived, not stored: it exists between any two people
// the trainer/athlete relationship (or a shared plan) links, and its
// messages are the `messages` rows between them — see list_message_threads.
// Someone you have never written to still gets a thread, which is how a
// first message is sent.
export type MessageType = "text" | "voice" | "image" | "video" | "file";

// What a non-text message reads as where there is no player — the inbox
// preview and the dashboard card.
const MEDIA_LABEL: Record<Exclude<MessageType, "text">, string> = {
  voice: "🎤 پیام صوتی",
  image: "🖼 عکس",
  video: "🎬 ویدیو",
  file: "📎 فایل",
};

export function messagePreview(type: MessageType | null, body: string | null): string | null {
  if (type && type !== "text") return MEDIA_LABEL[type];
  return body;
}

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
  lastMessageType: MessageType | null;
  // Archived by the viewer only; the counterpart's list is unaffected.
  isArchived: boolean;
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
  type: MessageType;
  // Null on a media message sent without a caption.
  body: string | null;
  mediaUrl: string | null;
  mediaName: string | null;
  createdAt: string;
}

export interface Conversation {
  plans: ConversationPlan[];
  messages: ConversationMessage[];
}
