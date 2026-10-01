"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAdminCan } from "@/features/admin/hooks/use-admin-access";
import { adminNavItemFor } from "./admin-sidebar-nav";

/**
 * A limited admin role reaching a page it has no permission for — by a
 * bookmark or a typed URL, since the menu doesn't list it. The API would
 * refuse every request on the page anyway; this says why instead.
 */
export function AdminRouteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const can = useAdminCan();
  const item = adminNavItemFor(pathname);

  if (!item || can(item.permission)) return <>{children}</>;

  return (
    <Card className="mx-auto flex max-w-lg flex-col items-center gap-4 py-14 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Lock className="size-6" />
      </div>
      <div className="space-y-1.5 px-6">
        <h2 className="text-lg font-semibold text-foreground">به «{item.label}» دسترسی ندارید</h2>
        <p className="text-sm text-muted-foreground">
          {item.permission === "super"
            ? "این بخش فقط برای مدیر کل است."
            : "نقش مدیریتی شما این بخش را شامل نمی‌شود. اگر لازم دارید، از مدیر کل بخواهید آن را به نقشتان اضافه کند."}
        </p>
      </div>
      <Button variant="outline" asChild>
        <Link href="/admin">بازگشت به نمای کلی</Link>
      </Button>
    </Card>
  );
}
