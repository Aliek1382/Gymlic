"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRequestOtp } from "../hooks/use-request-otp";
import { useVerifyOtp } from "../hooks/use-verify-otp";
import { OTP_RESEND_SECONDS } from "../constants/auth";
import { otpSchema, type OtpFormValues } from "../validators/auth-schemas";

export function OtpVerificationForm({ phone }: { phone: string }) {
  const router = useRouter();
  const verifyOtp = useVerifyOtp();
  const requestOtp = useRequestOtp();
  const [secondsLeft, setSecondsLeft] = useState(OTP_RESEND_SECONDS);

  const form = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" },
  });

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  async function onSubmit(values: OtpFormValues) {
    try {
      await verifyOtp.mutateAsync({ phone, code: values.code });
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "کد وارد شده صحیح نیست."
      );
    }
  }

  async function handleResend() {
    try {
      await requestOtp.mutateAsync(phone);
      setSecondsLeft(OTP_RESEND_SECONDS);
      toast.success("کد تایید مجدد ارسال شد.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "ارسال کد با خطا مواجه شد."
      );
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <p className="text-center text-sm text-muted-foreground">
        کد ارسال شده به شماره{" "}
        <bdi className="font-medium text-foreground" dir="ltr">
          {phone}
        </bdi>{" "}
        را وارد کنید.
      </p>

      <div className="space-y-2">
        <Label htmlFor="code">کد تایید</Label>
        <Input
          id="code"
          dir="ltr"
          inputMode="numeric"
          maxLength={6}
          placeholder="------"
          className="text-center text-lg tracking-[0.5em]"
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
        disabled={verifyOtp.isPending}
      >
        {verifyOtp.isPending && <Loader2 className="animate-spin" />}
        تایید و ورود
      </Button>

      <button
        type="button"
        onClick={handleResend}
        disabled={secondsLeft > 0 || requestOtp.isPending}
        className="w-full text-center text-sm text-primary disabled:text-muted-foreground"
      >
        {secondsLeft > 0
          ? `ارسال مجدد کد تا ${secondsLeft} ثانیه دیگر`
          : "ارسال مجدد کد تایید"}
      </button>
    </form>
  );
}
