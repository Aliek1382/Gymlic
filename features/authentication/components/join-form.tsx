"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/get-error-message";
import { useJoinViaInvitation } from "../hooks/use-join-via-invitation";
import { joinSchema, type JoinFormValues } from "../validators/auth-schemas";

export function JoinForm({ code }: { code: string }) {
  const router = useRouter();
  const join = useJoinViaInvitation();

  const form = useForm<JoinFormValues>({
    resolver: zodResolver(joinSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: JoinFormValues) {
    try {
      const { hasSession } = await join.mutateAsync({
        code,
        email: values.email,
        password: values.password,
      });
      if (hasSession) {
        router.push("/dashboard");
        router.refresh();
      } else {
        toast.success(
          "حساب شما ساخته شد. لطفاً ایمیل خود را برای تایید بررسی کنید."
        );
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "پیوستن با خطا مواجه شد."));
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="join-email">آدرس ایمیل</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="join-email"
            dir="ltr"
            type="email"
            placeholder="you@gmail.com"
            className="pr-10 text-center"
            {...form.register("email")}
          />
        </div>
        {form.formState.errors.email && (
          <p className="text-xs text-destructive">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="join-password">رمز عبور</Label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="join-password"
            dir="ltr"
            type="password"
            placeholder="••••••••"
            className="pr-10 text-center"
            {...form.register("password")}
          />
        </div>
        {form.formState.errors.password && (
          <p className="text-xs text-destructive">
            {form.formState.errors.password.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={join.isPending}
      >
        {join.isPending && <Loader2 className="animate-spin" />}
        پیوستن به جیم‌لیک
      </Button>
    </form>
  );
}
