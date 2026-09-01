"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getErrorMessage } from "@/lib/get-error-message";
import {
  MEMBER_STATUS_LABEL,
  MEMBER_STATUS_VALUES,
  PLAN_TIER_LABEL,
  PLAN_TIER_VALUES,
} from "../constants/members";
import { useUpdateMembership } from "../hooks/use-update-membership";
import {
  editMemberSchema,
  type EditMemberFormValues,
} from "../validators/member-schemas";
import type { ClubMember } from "../types/member-types";

export function EditMemberDialog({
  member,
  open,
  onOpenChange,
}: {
  member: ClubMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateMembership = useUpdateMembership();

  const form = useForm<EditMemberFormValues>({
    resolver: zodResolver(editMemberSchema),
    defaultValues: { planTier: member.planTier, status: member.status },
  });

  const { reset } = form;
  // The row's values can change under an open dialog (another tab, a
  // refetch), and the same dialog instance is reused across rows.
  useEffect(() => {
    if (open) reset({ planTier: member.planTier, status: member.status });
  }, [open, member.planTier, member.status, reset]);

  async function onSubmit(values: EditMemberFormValues) {
    try {
      await updateMembership.mutateAsync({
        membershipId: member.membershipId,
        planTier: values.planTier,
        status: values.status,
      });
      toast.success("عضویت به‌روزرسانی شد.");
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "به‌روزرسانی عضویت با خطا مواجه شد."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ویرایش عضویت {member.name}</DialogTitle>
          <DialogDescription>
            طرح و وضعیت عضویت این عضو را تغییر دهید. عضو معلق در شمارش اعضای
            فعال و ظرفیت پلن باشگاه حساب نمی‌شود.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-member-plan">طرح عضویت</Label>
            <Controller
              control={form.control}
              name="planTier"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="edit-member-plan" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_TIER_VALUES.map((tier) => (
                      <SelectItem key={tier} value={tier}>
                        {PLAN_TIER_LABEL[tier]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-member-status">وضعیت</Label>
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="edit-member-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMBER_STATUS_VALUES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {MEMBER_STATUS_LABEL[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={updateMembership.isPending}>
              {updateMembership.isPending && <Loader2 className="animate-spin" />}
              ذخیره تغییرات
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              انصراف
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
