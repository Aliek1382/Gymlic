"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { getErrorMessage } from "@/lib/get-error-message";
import { useCreateTrainerInvite } from "../hooks/use-create-trainer-invite";
import {
  addTrainerSchema,
  type AddTrainerFormValues,
} from "../validators/trainer-schemas";

export function AddTrainerDialog({
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
  const createInvite = useCreateTrainerInvite();

  const form = useForm<AddTrainerFormValues>({
    resolver: zodResolver(addTrainerSchema),
    defaultValues: { firstName: "", lastName: "", phone: "" },
  });

  async function onSubmit(values: AddTrainerFormValues) {
    try {
      const { code } = await createInvite.mutateAsync({
        clubId,
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone ? values.phone : null,
      });
      setInviteLink(`${window.location.origin}/join/${code}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "دعوت مربی با خطا مواجه شد."));
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button onClick={() => onOpenChange(true)}>
        <UserPlus />
        دعوت مربی جدید
      </Button>

      <DialogContent>
        {inviteLink ? (
          <>
            <DialogHeader>
              <DialogTitle>لینک دعوت مربی آماده شد</DialogTitle>
              <DialogDescription>
                این لینک را برای مربی ارسال کنید. اگر حساب جیم‌لیک ندارد با
                ایمیل و رمز عبور ثبت‌نام می‌کند و اگر از قبل به‌عنوان مربی
                حساب دارد، با همان حساب به باشگاه شما می‌پیوندد و شاگردانش هم
                عضو باشگاه می‌شوند.
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
              <DialogTitle>دعوت مربی جدید</DialogTitle>
              <DialogDescription>
                مشخصات مربی را وارد کنید تا یک لینک دعوت ساخته شود. تا زمان
                پذیرش، دعوت در بخش «دعوت‌های در انتظار» قابل پیگیری است.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="trainer-first-name">نام</Label>
                  <Input
                    id="trainer-first-name"
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
                  <Label htmlFor="trainer-last-name">نام خانوادگی</Label>
                  <Input
                    id="trainer-last-name"
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
                <Label htmlFor="trainer-phone">شماره موبایل (اختیاری)</Label>
                <Input
                  id="trainer-phone"
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

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={createInvite.isPending}
              >
                {createInvite.isPending && <Loader2 className="animate-spin" />}
                ساخت لینک دعوت
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
