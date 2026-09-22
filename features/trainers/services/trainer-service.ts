import { api, fullName, type ListResponse } from "@/lib/api/client";
import type { MembershipStatus } from "@/types/database.types";
import type {
  ClubTrainer,
  CreateTrainerInviteInput,
  PendingTrainerInvite,
} from "../types/trainer-types";

interface TrainerRow {
  id: string;
  user_id: string;
  status: MembershipStatus;
  joined_at: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  athlete_count: number;
}

/** The athlete count comes back as an aggregate rather than a second query. */
export async function listClubTrainers(clubId: string): Promise<ClubTrainer[]> {
  const data = await api.get<ListResponse<TrainerRow>>(`/clubs/${clubId}/trainers`);

  return data.items.map((row) => ({
    membershipId: row.id,
    userId: row.user_id,
    name: fullName(row.first_name, row.last_name),
    phone: row.phone,
    avatarUrl: row.avatar_url,
    status: row.status,
    joinedAt: row.joined_at,
    athleteCount: row.athlete_count,
  }));
}

export async function listPendingTrainerInvites(
  clubId: string
): Promise<PendingTrainerInvite[]> {
  const data = await api.get<
    ListResponse<{
      id: string;
      code: string;
      first_name: string | null;
      last_name: string | null;
      phone: string | null;
      created_at: string;
      expires_at: string;
    }>
  >(`/clubs/${clubId}/trainer-invites`);

  return data.items.map((row) => ({
    id: row.id,
    code: row.code,
    name: fullName(row.first_name, row.last_name),
    phone: row.phone,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));
}

export async function createTrainerInvite(
  input: CreateTrainerInviteInput
): Promise<{ code: string }> {
  return api.post<{ code: string }>(`/clubs/${input.clubId}/trainer-invites`, {
    first_name: input.firstName,
    last_name: input.lastName,
    phone: input.phone,
  });
}

export async function revokeTrainerInvite(invitationId: string): Promise<void> {
  await api.post(`/invitations/${invitationId}/revoke`);
}

export async function updateTrainerStatus(input: {
  membershipId: string;
  status: MembershipStatus;
}): Promise<void> {
  await api.patch(`/trainer-memberships/${input.membershipId}`, {
    status: input.status,
  });
}

/** The trainer's athletes stay in the club; only the club link is cleared. */
export async function removeTrainer(membershipId: string): Promise<void> {
  await api.delete(`/trainer-memberships/${membershipId}`);
}
