"use client";

import { useState } from "react";
import { Clock, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { formatPersianDate, toPersianDigits } from "@/lib/persian";
import { PLAN_TIER_LABEL } from "../constants/members";
import { useRevokeMemberInvite } from "../hooks/use-revoke-member-invite";
import { ConfirmDialog } from "./confirm-dialog";
import type { PendingMemberInvite } from "../types/member-types";

function InviteRow({
  invite,
  trainerName,
}: {
  invite: PendingMemberInvite;
  trainerName: string | null;
}) {
  const [revokeOpen, setRevokeOpen] = useState(false);
  const revokeInvite = useRevokeMemberInvite();

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Avatar className="size-9">
          <AvatarFallback className="text-xs">
            {invite.name.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium text-foreground">{invite.name}</p>
          <p className="text-xs text-muted-foreground">
            طرح {PLAN_TIER_LABEL[invite.planTier]}
            {trainerName ? ` · مربی: ${trainerName}` : ""}
            {" · "}
            اعتبار تا {formatPersianDate(new Date(invite.expiresAt))}
          </p>
          {invite.phone && (
            <p className="text-xs text-muted-foreground" dir="ltr">
              {invite.phone}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="warning">
          <Clock className="size-3" />
          در انتظار پذیرش
        </Badge>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(
              `${window.location.origin}/join/${invite.code}`
            );
            toast.success("لینک عضویت کپی شد.");
          }}
        >
          <Copy />
          کپی لینک
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => setRevokeOpen(true)}
        >
          <Trash2 />
          لغو دعوت
        </Button>
      </div>

      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title={`لغو دعوت ${invite.name}`}
        description="این دعوت باطل می‌شود و لینک آن دیگر کار نخواهد کرد."
        confirmLabel="بله، لغو کن"
        errorMessage="لغو دعوت با خطا مواجه شد."
        onConfirm={() => revokeInvite.mutateAsync(invite.id)}
      />
    </div>
  );
}

export function PendingInvitesCard({
  invites,
  trainerNameById,
}: {
  invites: PendingMemberInvite[];
  trainerNameById: Map<string, string>;
}) {
  return (
    <Card className="gap-4 py-5">
      <div className="px-6">
        <CardTitle className="text-base">
          دعوت‌های در انتظار ({toPersianDigits(invites.length)})
        </CardTitle>
      </div>
      <div className="space-y-2 px-6">
        {invites.map((invite) => (
          <InviteRow
            key={invite.id}
            invite={invite}
            trainerName={
              invite.trainerId
                ? (trainerNameById.get(invite.trainerId) ?? null)
                : null
            }
          />
        ))}
      </div>
    </Card>
  );
}
