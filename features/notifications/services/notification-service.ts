import { createClient } from "@/lib/supabase/client";
import type { NotificationType } from "@/types/database.types";
import type { NotificationItem } from "../types/notification-types";

const NOTIFICATION_PAGE_SIZE = 20;

interface NotificationRow {
  id: string;
  actor_id: string | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

function toNotificationItem(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    actorId: row.actor_id,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body,
    link: row.link,
    metadata: row.metadata,
    isRead: row.read_at !== null,
    createdAt: row.created_at,
  };
}

export async function getNotifications(userId: string): Promise<NotificationItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, actor_id, type, title, body, link, metadata, read_at, created_at")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(NOTIFICATION_PAGE_SIZE)
    .returns<NotificationRow[]>();
  if (error) throw error;

  return (data ?? []).map(toNotificationItem);
}

export async function markNotificationRead(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", userId)
    .is("read_at", null);
  if (error) throw error;
}

export interface BroadcastNotificationInput {
  title: string;
  body?: string | null;
  link?: string | null;
}

/** Fans out one notification row to every profile — restricted server-side
 * (create_broadcast_notification) to profiles.is_platform_admin. */
export async function sendBroadcastNotification(
  input: BroadcastNotificationInput
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("create_broadcast_notification", {
    p_title: input.title,
    p_body: input.body ?? null,
    p_link: input.link ?? null,
  });
  if (error) throw error;
}
