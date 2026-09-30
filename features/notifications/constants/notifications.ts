import {
  Apple,
  CalendarClock,
  Dumbbell,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Pill,
  Ruler,
  Sparkles,
  Ticket,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { NotificationType } from "@/types/database.types";

export const NOTIFICATION_ICON: Record<NotificationType, LucideIcon> = {
  invitation_accepted: UserPlus,
  workout_assigned: Dumbbell,
  nutrition_assigned: Apple,
  workout_completed: Dumbbell,
  nutrition_completed: Apple,
  measurement_recorded: Ruler,
  member_joined: Users,
  complete_profile: Sparkles,
  broadcast: Megaphone,
  calendar_reminder: CalendarClock,
  supplement_assigned: Pill,
  supplement_reminder: Pill,
  // Written by plan_comments' trigger until 0036; historical rows only.
  plan_comment: MessageSquare,
  message: MessageCircle,
  ticket: Ticket,
};
