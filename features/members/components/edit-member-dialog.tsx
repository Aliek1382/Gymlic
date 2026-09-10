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
import { JalaliDateField } from "@/components/ui/jalali-date-field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getErrorMessage } from "@/lib/get-error-message";
import { todayIso } from "@/lib/iso-date";
import { Switch } from "@/components/ui/switch";
import { useMembershipPlans } from "@/features/club";
import {
  MEMBER_STATUS_LABEL,
  MEMBER_STATUS_VALUES,
  NO_PLAN_VALUE,
} from "../constants/members";
import { useUpdateMembership } from "../hooks/use-update-membership";
import {
  editMemberSchema,
  type EditMemberFormValues,
} from "../validators/member-schemas";
import type { ClubMember } from "../types/member-types";

export function EditMemberDialog({
  clubId,
  member,
  open,
  onOpenChange,
}: {
  clubId: string;
  member: ClubMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateMembership = useUpdateMembership();
  const plans = useMembershipPlans(clubId, { activeOnly: true });

  const form = useForm<EditMemberFormValues>({
    resolver: zodResolver(editMemberSchema),
    defaultValues: {
      planId: member.planId ?? NO_PLAN_VALUE,
      status: member.status,
      hasEndDate: member.expiresAt !== null,
      expiresAt: member.expiresAt ?? todayIso(),
    },
  });

  const hasEndDate = form.watch("hasEndDate");

  const { reset } = form;
  // The row's values can change under an open dialog (another tab, a
  // refetch), and the same dialog instance is reused across rows.
  useEffect(() => {
    if (open) {
      reset({
        planId: member.planId ?? NO_PLAN_VALUE,
        status: member.status,
        hasEndDate: member.expiresAt !== null,
        expiresAt: member.expiresAt ?? todayIso(),
      });
    }
  }, [open, member.planId, member.status, member.expiresAt, reset]);

  async function onSubmit(values: EditMemberFormValues) {
    try {
      await updateMembership.mutateAsync({
        membershipId: member.membershipId,
        planId:
          values.planId && values.planId !== NO_PLAN_VALUE
            ? values.planId
            : null,
        status: values.status,
        expiresAt: values.hasEndDate ? values.expiresAt : null,
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
              name="planId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={plans.isLoading}
                >
                  <SelectTrigger id="edit-member-plan" className="w-full">
                    <SelectValue placeholder="بدون طرح" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PLAN_VALUE}>بدون طرح</SelectItem>
                    {/* A membership can sit on a plan the club has since
                        retired — keep it listed so editing the status does
                        not silently move the member to another plan. */}
                    {(plans.data ?? []).map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </SelectItem>
                    ))}
                    {member.planId &&
                      member.planName &&
                      !(plans.data ?? []).some((p) => p.id === member.planId) && (
                        <SelectItem value={member.planId}>
                          {member.planName} (غیرفعال)
                        </SelectItem>
                      )}
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

          <div className="space-y-3 rounded-xl border border-border p-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="edit-member-has-end-date">تاریخ پایان عضویت</Label>
                <p className="text-xs text-muted-foreground">
                  بدون تاریخ پایان، عضویت باز می‌ماند و در فهرست «رو به
                  انقضا» دیده نمی‌شود.
                </p>
              </div>
              <Controller
                control={form.control}
                name="hasEndDate"
                render={({ field }) => (
                  <Switch
                    id="edit-member-has-end-date"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>

            {hasEndDate && (
              <Controller
                control={form.control}
                name="expiresAt"
                render={({ field }) => (
                  <JalaliDateField
                    id="edit-member-expires-at"
                    label="پایان عضویت"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            )}
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
