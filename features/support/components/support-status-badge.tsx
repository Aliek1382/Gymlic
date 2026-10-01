import { Badge } from "@/components/ui/badge";
import { SUPPORT_STATUS_LABEL, type SupportStatus } from "../services/support-service";

const VARIANT: Record<SupportStatus, "warning" | "success" | "secondary"> = {
  open: "warning",
  answered: "success",
  closed: "secondary",
};

/** `forAdmin` names the status from support's side: "open" is waiting on them. */
export function SupportStatusBadge({ status, forAdmin = false }: { status: SupportStatus; forAdmin?: boolean }) {
  const label = forAdmin
    ? { open: "منتظر پاسخ شما", answered: "منتظر کاربر", closed: "بسته" }[status]
    : SUPPORT_STATUS_LABEL[status];
  return <Badge variant={VARIANT[status]}>{label}</Badge>;
}
