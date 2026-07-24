"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/get-error-message";
import { useAcceptInvitation } from "../hooks/use-accept-invitation";
import {
  invitationSchema,
  type InvitationFormValues,
} from "../validators/auth-schemas";

export function InvitationForm({ defaultCode }: { defaultCode?: string }) {
  const router = useRouter();
  const acceptInvitation = useAcceptInvitation();

  const form = useForm<InvitationFormValues>({
    resolver: zodResolver(invitationSchema),
    defaultValues: { code: defaultCode ?? "" },
  });

  async function onSubmit(values: InvitationFormValues) {
    try {
      await acceptInvitation.mutateAsync(values.code);
      toast.success("دعوت با موفقیت تایید شد.");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, "کد دعوت معتبر نیست."));
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="code">کد دعوت مربی</Label>
        <Input
          id="code"
          dir="ltr"
          className="text-center"
          placeholder="کد دعوت را وارد کنید"
          {...form.register("code")}
        />
        {form.formState.errors.code && (
          <p className="text-xs text-destructive">
            {form.formState.errors.code.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={acceptInvitation.isPending}
      >
        {acceptInvitation.isPending && <Loader2 className="animate-spin" />}
        تایید دعوت
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        برای استفاده از جیم‌لیک، ورزشکاران باید حداقل به یک مربی متصل باشند.
        کد دعوت را از مربی خود دریافت کنید.
      </p>
    </form>
  );
}
