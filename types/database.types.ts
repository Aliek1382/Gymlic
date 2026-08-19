/**
 * Hand-written mirror of the Supabase schema defined in
 * supabase/migrations/0001_init.sql and 0002_dashboard_metrics.sql.
 * Regenerate with the Supabase CLI (`supabase gen types typescript`) once a
 * live project is connected, and replace this file with the generated
 * output.
 */

export type AccountType = "club" | "trainer" | "athlete";
export type MembershipRole = "owner" | "trainer" | "reception" | "athlete";
export type MembershipStatus = "active" | "pending" | "suspended";
export type ClubStatus = "active" | "suspended";
export type SubscriptionStatus = "active" | "expiring" | "expired";
export type InvitationRole = "trainer" | "reception" | "athlete";
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";
export type WorkoutStatus = "active" | "completed" | "cancelled" | "draft";
export type MembershipPlanTier = "elite" | "basic" | "daily";
// Not a DB enum on purpose — `notifications.type` is plain text so new
// kinds can be introduced later without a migration. This union only
// covers the kinds the current triggers actually emit.
export type NotificationType =
  | "invitation_accepted"
  | "workout_assigned"
  | "nutrition_assigned"
  | "workout_completed"
  | "nutrition_completed"
  | "measurement_recorded"
  | "member_joined"
  | "complete_profile"
  | "broadcast";

type TableOf<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableOf<
        {
          id: string;
          phone: string | null;
          email: string | null;
          first_name: string | null;
          last_name: string | null;
          avatar_url: string | null;
          birth_date: string | null;
          account_type: AccountType | null;
          is_platform_admin: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          phone?: string | null;
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
          birth_date?: string | null;
          account_type?: AccountType | null;
          is_platform_admin?: boolean;
        }
      >;
      clubs: TableOf<
        {
          id: string;
          name: string;
          logo_url: string | null;
          owner_id: string;
          status: ClubStatus;
          member_capacity: number | null;
          created_at: string;
          updated_at: string;
        },
        {
          name: string;
          owner_id: string;
          logo_url?: string | null;
          status?: ClubStatus;
          member_capacity?: number | null;
        }
      >;
      memberships: TableOf<
        {
          id: string;
          club_id: string;
          user_id: string;
          role: MembershipRole;
          status: MembershipStatus;
          plan_tier: MembershipPlanTier;
          joined_at: string;
        },
        {
          club_id: string;
          user_id: string;
          role: MembershipRole;
          status?: MembershipStatus;
          plan_tier?: MembershipPlanTier;
        }
      >;
      trainer_athletes: TableOf<
        {
          id: string;
          trainer_id: string;
          athlete_id: string;
          club_id: string | null;
          status: MembershipStatus;
          created_at: string;
        },
        {
          trainer_id: string;
          athlete_id: string;
          club_id?: string | null;
          status?: MembershipStatus;
        }
      >;
      invitations: TableOf<
        {
          id: string;
          code: string;
          club_id: string | null;
          trainer_id: string | null;
          invited_role: InvitationRole;
          phone: string | null;
          first_name: string | null;
          last_name: string | null;
          height_cm: number | null;
          weight_kg: number | null;
          status: InvitationStatus;
          created_by: string;
          created_at: string;
          expires_at: string;
          accepted_by: string | null;
          accepted_at: string | null;
        },
        {
          code: string;
          invited_role: InvitationRole;
          created_by: string;
          club_id?: string | null;
          trainer_id?: string | null;
          phone?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          status?: InvitationStatus;
          expires_at?: string;
        },
        {
          status?: InvitationStatus;
          accepted_by?: string | null;
          accepted_at?: string | null;
        }
      >;
      subscriptions: TableOf<
        {
          id: string;
          club_id: string;
          plan_name: string;
          status: SubscriptionStatus;
          started_at: string;
          expires_at: string;
          created_at: string;
        },
        {
          club_id: string;
          plan_name: string;
          expires_at: string;
          status?: SubscriptionStatus;
        }
      >;
      workout_assignments: TableOf<
        {
          id: string;
          club_id: string | null;
          trainer_id: string;
          athlete_id: string | null;
          invitation_id: string | null;
          title: string;
          description: string | null;
          status: WorkoutStatus;
          is_template: boolean;
          assigned_at: string;
          updated_at: string;
        },
        {
          trainer_id: string;
          title: string;
          athlete_id?: string | null;
          invitation_id?: string | null;
          description?: string | null;
          club_id?: string | null;
          status?: WorkoutStatus;
          is_template?: boolean;
        }
      >;
      nutrition_assignments: TableOf<
        {
          id: string;
          club_id: string | null;
          trainer_id: string;
          athlete_id: string | null;
          invitation_id: string | null;
          title: string;
          description: string | null;
          status: WorkoutStatus;
          is_template: boolean;
          assigned_at: string;
          updated_at: string;
        },
        {
          trainer_id: string;
          title: string;
          athlete_id?: string | null;
          invitation_id?: string | null;
          description?: string | null;
          club_id?: string | null;
          status?: WorkoutStatus;
          is_template?: boolean;
        }
      >;
      measurements: TableOf<
        {
          id: string;
          athlete_id: string;
          recorded_by: string | null;
          height_cm: number | null;
          weight_kg: number | null;
          body_fat_percent: number | null;
          waist_cm: number | null;
          chest_cm: number | null;
          note: string | null;
          recorded_at: string;
        },
        {
          athlete_id: string;
          recorded_by?: string | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          body_fat_percent?: number | null;
          waist_cm?: number | null;
          chest_cm?: number | null;
          note?: string | null;
        }
      >;
      workout_day_logs: TableOf<
        {
          id: string;
          assignment_id: string;
          athlete_id: string;
          day_key: string;
          completed_on: string;
          created_at: string;
        },
        {
          assignment_id: string;
          athlete_id: string;
          day_key: string;
          completed_on?: string;
        }
      >;
      activity_logs: TableOf<
        {
          id: string;
          club_id: string | null;
          actor_id: string | null;
          subject_id: string | null;
          action: string;
          metadata: Record<string, unknown>;
          created_at: string;
        },
        {
          action: string;
          club_id?: string | null;
          actor_id?: string | null;
          subject_id?: string | null;
          metadata?: Record<string, unknown>;
        }
      >;
      revenue_entries: TableOf<
        {
          id: string;
          club_id: string;
          amount: number;
          occurred_at: string;
          created_at: string;
        },
        {
          club_id: string;
          amount: number;
          occurred_at?: string;
        }
      >;
      class_attendance_logs: TableOf<
        {
          id: string;
          club_id: string;
          member_id: string;
          attended: boolean;
          class_date: string;
          created_at: string;
        },
        {
          club_id: string;
          member_id: string;
          attended?: boolean;
          class_date?: string;
        }
      >;
      exercises: TableOf<
        {
          id: string;
          name: string;
          name_en: string | null;
          description: string | null;
          muscle_group: string;
          created_by: string | null;
          created_at: string;
        },
        {
          name: string;
          muscle_group: string;
          name_en?: string | null;
          description?: string | null;
          created_by?: string | null;
        }
      >;
      exercise_usage: TableOf<
        {
          id: string;
          trainer_id: string;
          exercise_id: string;
          use_count: number;
          last_used_at: string;
        },
        {
          trainer_id: string;
          exercise_id: string;
          use_count?: number;
          last_used_at?: string;
        }
      >;
      notifications: TableOf<
        {
          id: string;
          recipient_id: string;
          actor_id: string | null;
          type: NotificationType;
          title: string;
          body: string | null;
          link: string | null;
          metadata: Record<string, unknown>;
          read_at: string | null;
          created_at: string;
        },
        {
          recipient_id: string;
          actor_id?: string | null;
          type: NotificationType;
          title: string;
          body?: string | null;
          link?: string | null;
          metadata?: Record<string, unknown>;
          read_at?: string | null;
        },
        { read_at: string | null }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      get_invitation_preview: {
        Args: { p_code: string };
        Returns: { first_name: string | null; last_name: string | null }[];
      };
      accept_athlete_invitation: {
        Args: { p_code: string };
        Returns: undefined;
      };
      complete_workout_assignment: {
        Args: { p_id: string };
        Returns: undefined;
      };
      complete_nutrition_assignment: {
        Args: { p_id: string };
        Returns: undefined;
      };
      create_broadcast_notification: {
        Args: { p_title: string; p_body?: string | null; p_link?: string | null };
        Returns: undefined;
      };
    };
  };
}
