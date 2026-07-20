"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Phone } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRequestOtp } from "../hooks/use-request-otp";
import { phoneSchema, type PhoneFormValues } from "../validators/auth-schemas";

export function PhoneLoginForm() {
  const router = useRouter();
  const requestOtp = useRequestOtp();

  const form = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "" },
  });

  async function onSubmit(values: PhoneFormValues) {
    try {
      await requestOtp.mutateAsync(values.phone);
      router.push(`/verify-otp?phone=${encodeURIComponent(values.phone)}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "ارسال کد با خطا مواجه شد."
      );
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="phone">شماره موبایل</Label>
        <div className="relative">
          <Phone className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="phone"
            dir="ltr"
            inputMode="numeric"
            placeholder="09123456789"
            className="pr-10 text-center"
            {...form.register("phone")}
          />
        </div>
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
        disabled={requestOtp.isPending}
      >
        {requestOtp.isPending && <Loader2 className="animate-spin" />}
        دریافت کد تایید
      </Button>
    </form>
  );
}
