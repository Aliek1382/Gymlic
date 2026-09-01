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
import { useCreateAthleteInvite } from "../hooks/use-create-athlete-invite";
import { useTrainerClub } from "../hooks/use-trainer-club";
import {
  addAthleteSchema,
  type AddAthleteFormValues,
} from "../validators/athlete-schemas";

export function AddAthleteDialog() {
  const [open, setOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const createInvite = useCreateAthleteInvite();
  const trainerClub = useTrainerClub();

  const form = useForm<AddAthleteFormValues>({
    resolver: zodResolver(addAthleteSchema),
    defaultValues: { firstName: "", lastName: "", heightCm: "", weightKg: "" },
  });

  async function onSubmit(values: AddAthleteFormValues) {
    try {
      const { code } = await createInvite.mutateAsync({
        firstName: values.firstName,
        lastName: values.lastName,
        heightCm: values.heightCm ? Number(values.heightCm) : null,
        weightKg: values.weightKg ? Number(values.weightKg) : null,
      });
      setInviteLink(`${window.location.origin}/join/${code}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "افزودن ورزشکار با خطا مواجه شد."));
    }
  }

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setInviteLink(null);
      setCopied(false);
      form.reset();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button onClick={() => setOpen(true)}>
        <UserPlus />
        افزودن ورزشکار جدید
      </Button>

      <DialogContent>
        {inviteLink ? (
          <>
            <DialogHeader>
              <DialogTitle>لینک دعوت آماده شد</DialogTitle>
              <DialogDescription>
                این لینک را برای ورزشکار ارسال کنید. با کلیک روی آن، فقط با
                وارد کردن ایمیل و رمز عبور، به پنل ورزشکار وارد می‌شود.
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
              <DialogTitle>افزودن ورزشکار جدید</DialogTitle>
              <DialogDescription>
                مشخصات اولیه ورزشکار را وارد کنید. قد و وزن اختیاری هستند.
                {trainerClub.data
                  ? ` این ورزشکار به‌عنوان عضو باشگاه «${trainerClub.data.name}» هم ثبت می‌شود.`
                  : ""}
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="athlete-first-name">نام</Label>
                  <Input
                    id="athlete-first-name"
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
                  <Label htmlFor="athlete-last-name">نام خانوادگی</Label>
                  <Input
                    id="athlete-last-name"
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="athlete-height">قد (سانتی‌متر)</Label>
                  <Input
                    id="athlete-height"
                    dir="ltr"
                    inputMode="decimal"
                    placeholder="اختیاری"
                    className="text-center"
                    {...form.register("heightCm")}
                  />
                  {form.formState.errors.heightCm && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.heightCm.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="athlete-weight">وزن (کیلوگرم)</Label>
                  <Input
                    id="athlete-weight"
                    dir="ltr"
                    inputMode="decimal"
                    placeholder="اختیاری"
                    className="text-center"
                    {...form.register("weightKg")}
                  />
                  {form.formState.errors.weightKg && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.weightKg.message}
                    </p>
                  )}
                </div>
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
