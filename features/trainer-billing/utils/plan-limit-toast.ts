import { toast } from "sonner";

import { ApiError } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/get-error-message";

/** The server's answers when a plan's cap or an ended subscription blocks an action (Limits). */
const PLAN_LIMIT_CODES = new Set([
  "plan_limit",
  "trainer_plan_required",
  "capacity_full",
  "trainer_capacity_full",
  "club_plan_required",
]);

/**
 * Shows an error from an invite; when it is a plan's cap, with a button to
 * the page where the plan is upgraded (the trainer's "my subscription", the
 * club's finance page).
 */
export function showPlanLimitError(
  error: unknown,
  fallback: string,
  upgrade: { href: string; navigate: (href: string) => void } | null
): void {
  const message = getErrorMessage(error, fallback);
  if (upgrade && error instanceof ApiError && PLAN_LIMIT_CODES.has(error.code)) {
    toast.error(message, {
      duration: 10_000,
      action: { label: "ارتقای پلن", onClick: () => upgrade.navigate(upgrade.href) },
    });
    return;
  }
  toast.error(message);
}
