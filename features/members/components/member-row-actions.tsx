"use client";

import { useState } from "react";
import { MoreVertical, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getErrorMessage } from "@/lib/get-error-message";
import { useRemoveMember } from "../hooks/use-remove-member";
import { useUpdateMembership } from "../hooks/use-update-membership";
import { EditMemberDialog } from "./edit-member-dialog";
import type { ClubMember } from "../types/member-types";

export function MemberRowActions({ member }: { member: ClubMember }) {
  const [editOpen, setEditOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const updateMembership = useUpdateMembership();
  const removeMember = useRemoveMember();

  const isSuspended = member.status === "suspended";

  async function toggleSuspended() {
    try {
      await updateMembership.mutateAsync({
        membershipId: member.membershipId,
        status: isSuspended ? "active" : "suspended",
      });
      toast.success(isSuspended ? "عضویت فعال شد." : "عضویت معلق شد.");
    } catch (error) {
      toast.error(getErrorMessage(error, "تغییر وضعیت با خطا مواجه شد."));
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label={`عملیات ${member.name}`}>
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil />
            ویرایش طرح و وضعیت
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={toggleSuspended}
            disabled={updateMembership.isPending}
          >
            {isSuspended ? <Play /> : <Pause />}
            {isSuspended ? "فعال‌سازی عضویت" : "تعلیق عضویت"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setRemoveOpen(true)}
          >
            <Trash2 />
            حذف از باشگاه
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditMemberDialog
        member={member}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={`حذف ${member.name} از باشگاه`}
        description="عضویت این شخص در باشگاه شما حذف می‌شود. حساب کاربری، برنامه‌ها و ارتباط او با مربی حذف نمی‌شود و در صورت نیاز می‌توانید دوباره او را دعوت کنید."
        confirmLabel="بله، حذف کن"
        errorMessage="حذف عضو با خطا مواجه شد."
        onConfirm={() => removeMember.mutateAsync(member.membershipId)}
      />
    </>
  );
}
