"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2, Mail, Phone, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRequestOtp } from "../hooks/use-request-otp";
import { useSignInWithPassword } from "../hooks/use-sign-in-with-password";
import { useSignUpWithPassword } from "../hooks/use-sign-up-with-password";
import {
  emailSchema,
  passwordLoginSchema,
  phoneSchema,
  signUpSchema,
  type EmailFormValues,
  type LoginMethod,
  type PasswordLoginFormValues,
  type PhoneFormValues,
  type SignUpFormValues,
} from "../validators/auth-schemas";

export function LoginForm() {
  const [method, setMethod] = useState<LoginMethod>("phone");

  return (
    <div className="space-y-5">
      <Tabs
        value={method}
        onValueChange={(value) => setMethod(value as LoginMethod)}
      >
        <TabsList className="w-full">
          <TabsTrigger value="phone">
            <Phone className="size-4" />
            موبایل
          </TabsTrigger>
          <TabsTrigger value="email">
            <Mail className="size-4" />
            ایمیل
          </TabsTrigger>
          <TabsTrigger value="password">
            <KeyRound className="size-4" />
            رمز عبور
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {method === "phone" && <PhoneStep />}
      {method === "email" && <EmailStep />}
      {method === "password" && <PasswordStep />}
    </div>
  );
}

function PhoneStep() {
  const router = useRouter();
  const requestOtp = useRequestOtp();

  const form = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "" },
  });

  async function onSubmit(values: PhoneFormValues) {
    try {
      await requestOtp.mutateAsync({ method: "phone", value: values.phone });
      router.push(
        `/verify-otp?method=phone&value=${encodeURIComponent(values.phone)}`
      );
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

function EmailStep() {
  const router = useRouter();
  const requestOtp = useRequestOtp();

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: EmailFormValues) {
    try {
      await requestOtp.mutateAsync({ method: "email", value: values.email });
      router.push(
        `/verify-otp?method=email&value=${encodeURIComponent(values.email)}`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "ارسال کد با خطا مواجه شد."
      );
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">ایمیل</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
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

function PasswordStep() {
  const [mode, setMode] = useState<"login" | "signup">("login");

  return mode === "login" ? (
    <PasswordLoginStep onSwitchToSignUp={() => setMode("signup")} />
  ) : (
    <SignUpStep onSwitchToLogin={() => setMode("login")} />
  );
}

function PasswordLoginStep({
  onSwitchToSignUp,
}: {
  onSwitchToSignUp: () => void;
}) {
  const router = useRouter();
  const signIn = useSignInWithPassword();

  const form = useForm<PasswordLoginFormValues>({
    resolver: zodResolver(passwordLoginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: PasswordLoginFormValues) {
    try {
      await signIn.mutateAsync(values);
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "ورود با خطا مواجه شد."
      );
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="login-email">ایمیل</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="login-email"
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
        <Label htmlFor="login-password">رمز عبور</Label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="login-password"
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
        disabled={signIn.isPending}
      >
        {signIn.isPending && <Loader2 className="animate-spin" />}
        ورود
      </Button>

      <button
        type="button"
        onClick={onSwitchToSignUp}
        className="w-full text-center text-sm text-primary hover:underline"
      >
        حساب کاربری ندارید؟ ثبت‌نام کنید
      </button>
    </form>
  );
}

function SignUpStep({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const router = useRouter();
  const signUp = useSignUpWithPassword();

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  async function onSubmit(values: SignUpFormValues) {
    try {
      const { hasSession } = await signUp.mutateAsync(values);
      if (hasSession) {
        router.push("/dashboard");
        router.refresh();
      } else {
        toast.success(
          "حساب شما ساخته شد. لطفاً ایمیل خود را برای تایید بررسی کنید."
        );
        onSwitchToLogin();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "ثبت‌نام با خطا مواجه شد."
      );
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="signup-name">نام</Label>
        <div className="relative">
          <User className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="signup-name"
            placeholder="نام شما"
            className="pr-10 text-center"
            {...form.register("name")}
          />
        </div>
        {form.formState.errors.name && (
          <p className="text-xs text-destructive">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-email">ایمیل</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="signup-email"
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
        <Label htmlFor="signup-password">رمز عبور</Label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="signup-password"
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
        disabled={signUp.isPending}
      >
        {signUp.isPending && <Loader2 className="animate-spin" />}
        ایجاد حساب کاربری
      </Button>

      <button
        type="button"
        onClick={onSwitchToLogin}
        className="w-full text-center text-sm text-primary hover:underline"
      >
        قبلاً ثبت‌نام کرده‌اید؟ ورود
      </button>
    </form>
  );
}
