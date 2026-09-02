"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useRemoveMember } from "../hooks/use-remove-member";
import type { ClubMember } from "../types/member-types";
import { EditMemberDialog } from "./edit-member-dialog";

/** Edit and remove, on the member's own page rather than in the row menu. */
export function MemberProfileActions({
  clubId,
  member,
}: {
  clubId: string;
  member: ClubMember;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const removeMember = useRemoveMember();

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
        <Pencil />
        ویرایش عضویت
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setRemoveOpen(true)}
      >
        <Trash2 />
        حذف از باشگاه
      </Button>

      <EditMemberDialog
        clubId={clubId}
        member={member}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          // The page is server-rendered, so pull the saved values back in.
          if (!open) router.refresh();
        }}
      />

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={`حذف ${member.name} از باشگاه`}
        description="عضویت این شخص در باشگاه شما حذف می‌شود. حساب کاربری، برنامه‌ها و ارتباط او با مربی حذف نمی‌شود و در صورت نیاز می‌توانید دوباره او را دعوت کنید."
        confirmLabel="بله، حذف کن"
        errorMessage="حذف عضو با خطا مواجه شد."
        onConfirm={async () => {
          await removeMember.mutateAsync(member.membershipId);
          router.push("/members");
        }}
      />
    </div>
  );
}
