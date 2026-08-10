import type { NotificationType } from "@/types/database.types";

export interface NotificationItem {
  id: string;
  actorId: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  metadata: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}
