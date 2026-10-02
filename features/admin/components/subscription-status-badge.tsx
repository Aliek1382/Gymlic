import { Badge } from "@/components/ui/badge";
import type { SubscriptionStatus } from "@/types/database.types";

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: "فعال",
  expiring: "رو به اتمام",
  grace: "در مهلت",
  expired: "منقضی",
};

const VARIANT: Record<SubscriptionStatus, "success" | "warning" | "destructive"> = {
  active: "success",
  expiring: "warning",
  grace: "warning",
  expired: "destructive",
};

/** A club's platform subscription; null = the club has never had one. */
export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus | null }) {
  if (!status) return <Badge variant="secondary">بدون اشتراک</Badge>;
  return <Badge variant={VARIANT[status]}>{SUBSCRIPTION_STATUS_LABEL[status]}</Badge>;
}
