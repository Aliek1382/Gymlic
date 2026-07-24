"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dumbbell, KeyRound, Loader2, Mail, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/get-error-message";
import { useSignInWithPassword } from "../hooks/use-sign-in-with-password";
import { useSignUpWithPassword } from "../hooks/use-sign-up-with-password";
import {
  loginSchema,
  signUpSchema,
  type LoginFormValues,
  type SignUpFormValues,
} from "../validators/auth-schemas";
import { AuthIllustration } from "./auth-illustration";

type Mode = "login" | "signup";

const COPY: Record<Mode, { title: string; description: string }> = {
  login: {
    title: "مدیریت حرفه‌ای باشگاه",
    description:
      "عملیات باشگاه، مربیان و اعضا را ساده کنید و کسب‌وکار خود را با دقت رشد دهید.",
  },
  signup: {
    title: "کسب‌وکار تناسب اندام خود را با دقت رشد دهید.",
    description:
      "به مدیران باشگاه و مربیانی بپیوندید که برای مدیریت اعضا، برنامه‌ها و تحلیل‌ها به جیم‌لیک اعتماد دارند.",
  },
};

export function AuthSplitCard() {
  const [mode, setMode] = useState<Mode>("login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-4xl overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="flex w-full flex-col justify-center px-6 py-10 sm:px-12 lg:w-[58%]">
          <div className="mb-8 flex items-center justify-end gap-2.5 lg:hidden">
            <span className="text-lg font-bold text-foreground">جیم‌لیک</span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Dumbbell className="size-4" />
            </div>
          </div>

          {mode === "login" ? (
            <LoginPanel onSwitchToSignUp={() => setMode("signup")} />
          ) : (
            <SignUpPanel onSwitchToLogin={() => setMode("login")} />
          )}
        </div>

        <AuthIllustration
          title={COPY[mode].title}
          description={COPY[mode].description}
        />
      </div>
    </div>
  );
}

function LoginPanel({ onSwitchToSignUp }: { onSwitchToSignUp: () => void }) {
  const router = useRouter();
  const signIn = useSignInWithPassword();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    try {
      await signIn.mutateAsync(values);
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, "ورود با خطا مواجه شد."));
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold text-foreground">خوش‌آمدید</h1>
        <p className="text-sm text-muted-foreground">
          برای دسترسی به داشبورد، مشخصات خود را وارد کنید.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="login-email">آدرس ایمیل</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="login-email"
              dir="ltr"
              type="email"
              placeholder="name@gymlic.com"
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
      </form>

      <p className="text-center text-sm text-muted-foreground">
        حساب کاربری ندارید؟{" "}
        <button
          type="button"
          onClick={onSwitchToSignUp}
          className="font-medium text-primary hover:underline"
        >
          ثبت‌نام کنید
        </button>
      </p>
    </div>
  );
}

function SignUpPanel({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
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
      toast.error(getErrorMessage(error, "ثبت‌نام با خطا مواجه شد."));
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold text-foreground">
          ایجاد حساب کاربری
        </h1>
        <p className="text-sm text-muted-foreground">
          دوره آزمایشی خود را شروع کنید. بدون نیاز به کارت اعتباری.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="signup-name">نام و نام خانوادگی</Label>
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
          <Label htmlFor="signup-email">آدرس ایمیل</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="signup-email"
              dir="ltr"
              type="email"
              placeholder="name@company.com"
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
      </form>

      <p className="text-center text-sm text-muted-foreground">
        قبلاً حساب کاربری داشته‌اید؟{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-medium text-primary hover:underline"
        >
          ورود
        </button>
      </p>
    </div>
  );
}
