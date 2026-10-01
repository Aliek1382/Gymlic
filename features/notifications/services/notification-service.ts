import { api, query, type ListResponse } from "@/lib/api/client";
import type { NotificationType } from "@/types/database.types";
import type { NotificationItem } from "../types/notification-types";

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

export async function getNotifications(): Promise<NotificationItem[]> {
  const data = await api.get<ListResponse<NotificationRow>>("/notifications");
  return data.items.map(toNotificationItem);
}

export interface NotificationsPage {
  items: NotificationItem[];
  // The oldest row's `created_at` in this page — pass back as `cursor` to
  // fetch the next one. `null` once there's nothing older left.
  nextCursor: string | null;
}

// Keyset pagination on `created_at` rather than offsets — offsets shift under
// a live-updating list (a new notification lands, or one's marked read) and
// would duplicate or skip rows across pages.
export async function getNotificationsPage(
  cursor?: string | null
): Promise<NotificationsPage> {
  const data = await api.get<ListResponse<NotificationRow> & { next_cursor: string | null }>(
    `/notifications/archive${query({ cursor })}`
  );

  return {
    items: data.items.map(toNotificationItem),
    nextCursor: data.next_cursor,
  };
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.post(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post("/notifications/read-all");
}
