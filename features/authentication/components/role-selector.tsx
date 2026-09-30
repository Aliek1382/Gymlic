"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Dumbbell, Loader2, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/get-error-message";
import { useChooseRole } from "../hooks/use-choose-role";
import { ROLE_OPTIONS } from "../constants/auth";
import { useAuthContext } from "../hooks/use-auth-context";
import { SupportContact, usePublicSettings } from "@/features/site-settings";
import type { AccountType } from "@/types/database.types";

const ICONS: Record<AccountType, typeof Building2> = {
  club: Building2,
  trainer: Dumbbell,
  athlete: User,
};

export function RoleSelector() {
  const router = useRouter();
  const chooseRole = useChooseRole();
  const [selected, setSelected] = useState<AccountType | null>(null);
  const { signup } = usePublicSettings();
  const { data: context } = useAuthContext();
  // Roles the admin closed to self sign-up (the API refuses them too).
  const options = ROLE_OPTIONS.filter(
    (option) => context?.isPlatformAdmin || signup.roles[option.value] !== false
  );

  if (options.length === 0) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          در حال حاضر ثبت‌نام با هیچ نقشی باز نیست. اگر لینک دعوت دارید، از همان لینک وارد شوید.
        </p>
        <SupportContact />
      </div>
    );
  }

  async function handleContinue() {
    if (!selected) return;
    try {
      await chooseRole.mutateAsync(selected);
      if (selected === "club") router.push("/create-club");
      else if (selected === "athlete") router.push("/invitation");
      else router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, "ثبت نقش با خطا مواجه شد."));
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {options.map((option) => {
          const Icon = ICONS[option.value as AccountType];
          const isActive = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelected(option.value as AccountType)}
              className={cn(
                "flex w-full items-center gap-4 rounded-2xl border p-4 text-right transition-colors",
                isActive
                  ? "border-primary bg-accent"
                  : "border-border hover:bg-muted"
              )}
            >
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="size-5" />
              </div>
              <div>
                <p className="font-medium text-foreground">{option.title}</p>
                <p className="text-xs text-muted-foreground">
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <Button
        size="lg"
        className="w-full"
        disabled={!selected || chooseRole.isPending}
        onClick={handleContinue}
      >
        {chooseRole.isPending && <Loader2 className="animate-spin" />}
        ادامه
      </Button>
    </div>
  );
}
