"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/get-error-message";
import type { InvitationRole } from "@/types/database.types";
import { signOut } from "../services/auth-service";
import { useAcceptInvitationForCurrentUser } from "../hooks/use-accept-invitation-for-current-user";

/**
 * The /join branch for a visitor who is already signed in — a trainer who
 * already uses Gymlic being invited to a club, most of all. Signing up again
 * is impossible for them (the email is taken), so the invite is accepted with
 * the account they are holding.
 */
export function JoinSignedInForm({
  code,
  invitedRole,
  accountLabel,
}: {
  code: string;
  invitedRole: InvitationRole;
  accountLabel: string;
}) {
  const router = useRouter();
  const acceptInvitation = useAcceptInvitationForCurrentUser();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleAccept() {
    try {
      await acceptInvitation.mutateAsync({ code, invitedRole });
      toast.success("دعوت با موفقیت پذیرفته شد.");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, "پذیرش دعوت با خطا مواجه شد."));
    }
  }

  // Signing out stays on this page rather than going to /login, so the
  // visitor can immediately sign up against the same invite link.
  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut();
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, "خروج از حساب با خطا مواجه شد."));
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-muted-foreground">
        شما با حساب <span className="font-medium text-foreground">{accountLabel}</span>{" "}
        وارد شده‌اید.
      </p>

      <Button
        size="lg"
        className="w-full"
        onClick={handleAccept}
        disabled={acceptInvitation.isPending}
      >
        {acceptInvitation.isPending && <Loader2 className="animate-spin" />}
        پذیرش دعوت با همین حساب
      </Button>

      <Button
        variant="outline"
        size="lg"
        className="w-full"
        onClick={handleSignOut}
        disabled={isSigningOut}
      >
        {isSigningOut && <Loader2 className="animate-spin" />}
        خروج و ساخت حساب جدید
      </Button>
    </div>
  );
}
