"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getErrorMessage } from "@/lib/get-error-message";
import { useMembershipPlans } from "@/features/club";
import { NO_PLAN_VALUE } from "../constants/members";
import { useClubTrainers } from "../hooks/use-club-trainers";
import { useCreateMemberInvite } from "../hooks/use-create-member-invite";
import {
  addMemberSchema,
  type AddMemberFormValues,
} from "../validators/member-schemas";

// Radix Select cannot hold an empty string, so "no trainer yet" needs a
// sentinel value that maps back to null on submit.
const NO_TRAINER_VALUE = "none";

export function AddMemberDialog({
  clubId,
  open,
  onOpenChange,
}: {
  clubId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const trainers = useClubTrainers(clubId);
  const plans = useMembershipPlans(clubId, { activeOnly: true });
  const createInvite = useCreateMemberInvite();

  const form = useForm<AddMemberFormValues>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      planId: NO_PLAN_VALUE,
      trainerId: NO_TRAINER_VALUE,
    },
  });

  async function onSubmit(values: AddMemberFormValues) {
    try {
      const { code } = await createInvite.mutateAsync({
        clubId,
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone ? values.phone : null,
        planId:
          values.planId && values.planId !== NO_PLAN_VALUE
            ? values.planId
            : null,
        trainerId:
          values.trainerId && values.trainerId !== NO_TRAINER_VALUE
            ? values.trainerId
            : null,
      });
      setInviteLink(`${window.location.origin}/join/${code}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "افزودن عضو با خطا مواجه شد."));
    }
  }

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setInviteLink(null);
      setCopied(false);
      form.reset();
    }
  }

  const trainerOptions = trainers.data ?? [];
  const planOptions = plans.data ?? [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button onClick={() => onOpenChange(true)}>
        <UserPlus />
        افزودن عضو جدید
      </Button>

      <DialogContent>
        {inviteLink ? (
          <>
            <DialogHeader>
              <DialogTitle>لینک عضویت آماده شد</DialogTitle>
              <DialogDescription>
                این لینک را برای عضو ارسال کنید. با باز کردن آن و وارد کردن
                ایمیل و رمز عبور، عضویتش در باشگاه شما نهایی می‌شود.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-2">
              <Input dir="ltr" readOnly value={inviteLink} className="text-xs" />
              <Button type="button" size="icon" variant="outline" onClick={copyLink}>
                {copied ? <Check className="text-success" /> : <Copy />}
              </Button>
            </div>

            <Button className="w-full" onClick={() => handleOpenChange(false)}>
              بستن
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>افزودن عضو جدید</DialogTitle>
              <DialogDescription>
                مشخصات عضو و طرح عضویتش را وارد کنید. یک لینک عضویت ساخته
                می‌شود که تا زمان پذیرش، در بخش «دعوت‌های در انتظار» قابل
                پیگیری است.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="member-first-name">نام</Label>
                  <Input
                    id="member-first-name"
                    placeholder="نام"
                    {...form.register("firstName")}
                  />
                  {form.formState.errors.firstName && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.firstName.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="member-last-name">نام خانوادگی</Label>
                  <Input
                    id="member-last-name"
                    placeholder="نام خانوادگی"
                    {...form.register("lastName")}
                  />
                  {form.formState.errors.lastName && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.lastName.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="member-phone">شماره موبایل (اختیاری)</Label>
                <Input
                  id="member-phone"
                  dir="ltr"
                  inputMode="numeric"
                  placeholder="09xxxxxxxxx"
                  className="text-center"
                  {...form.register("phone")}
                />
                {form.formState.errors.phone && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.phone.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="member-plan">طرح عضویت</Label>
                <Controller
                  control={form.control}
                  name="planId"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={plans.isLoading}
                    >
                      <SelectTrigger id="member-plan" className="w-full">
                        <SelectValue
                          placeholder={
                            plans.isLoading ? "در حال بارگذاری…" : "بدون طرح"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_PLAN_VALUE}>بدون طرح</SelectItem>
                        {planOptions.map((plan) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            {plan.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {!plans.isLoading && planOptions.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    هنوز طرح عضویتی تعریف نکرده‌اید. از تنظیمات ← طرح‌های
                    عضویت می‌توانید طرح‌های باشگاه خود را بسازید.
                  </p>
                )}
              </div>

              {trainerOptions.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="member-trainer">مربی (اختیاری)</Label>
                  <Controller
                    control={form.control}
                    name="trainerId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="member-trainer" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_TRAINER_VALUE}>
                            بدون مربی
                          </SelectItem>
                          {trainerOptions.map((trainer) => (
                            <SelectItem key={trainer.id} value={trainer.id}>
                              {trainer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    اگر مربی را الان مشخص کنید، عضو به‌محض پذیرش دعوت به لیست
                    شاگردان او اضافه می‌شود.
                  </p>
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={createInvite.isPending}
              >
                {createInvite.isPending && <Loader2 className="animate-spin" />}
                ساخت لینک عضویت
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
