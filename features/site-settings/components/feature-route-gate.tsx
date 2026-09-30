"use client";

import { usePathname } from "next/navigation";
import { EyeOff, Lock } from "lucide-react";

import { Card } from "@/components/ui/card";
import { useAuthContext } from "@/features/authentication/hooks/use-auth-context";
import { featureForPath } from "../constants";
import { usePublicSettings } from "../hooks/use-site-settings";
import { isFeatureEnabled } from "../services/site-settings-service";
import { SupportContact } from "./support-contact";

/**
 * Shows a panel page only if the admin hasn't switched its section off for
 * this user's role. The menu entry is hidden too, but a bookmarked or typed
 * URL still lands here. (The API refuses the page's requests either way.)
 *
 * A platform admin still sees the page, as the API still serves them, with
 * a note that other users don't.
 */
export function FeatureRouteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { features } = usePublicSettings();
  const { data: context } = useAuthContext();

  const feature = featureForPath(pathname);
  const enabled = !feature || isFeatureEnabled(features, feature, context?.accountType);

  if (enabled) return <>{children}</>;

  if (context?.isPlatformAdmin) {
    return (
      <>
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          <EyeOff className="size-5 shrink-0" />
          این بخش برای کاربران غیرفعال است و فقط شما (به‌عنوان مدیر) آن را می‌بینید.
        </div>
        {children}
      </>
    );
  }

  return (
    <Card className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Lock className="size-6" />
      </div>
      <div className="space-y-1.5 px-6">
        <h2 className="text-lg font-semibold text-foreground">این بخش غیرفعال است</h2>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          مدیریت جیم‌لیک این بخش را فعلاً غیرفعال کرده است. اگر فکر می‌کنید اشتباهی رخ داده،
          با پشتیبانی تماس بگیرید.
        </p>
      </div>
      <SupportContact className="px-6" />
    </Card>
  );
}
