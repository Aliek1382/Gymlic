"use client";

import { ToggleRight } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ROLE_LABEL } from "@/components/layout/sidebar-nav";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/get-error-message";
import {
  useAdminSiteSettings,
  useUpdateSiteSetting,
  type FeatureCatalogEntry,
  type FeatureSettings,
  type FeatureState,
} from "@/features/site-settings";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import type { AccountType } from "@/types/database.types";
import { SettingsStorageNotice } from "./settings-storage-notice";

export function AdminFeaturesPage() {
  const { data, isLoading, isError } = useAdminSiteSettings();
  const update = useUpdateSiteSetting("features");

  function save(next: FeatureSettings, message: string) {
    update.mutate({ value: next }, {
      onSuccess: () => toast.success(message),
      onError: (error) => toast.error(getErrorMessage(error, "ذخیرهٔ تغییر با خطا مواجه شد.")),
    });
  }

  function change(entry: FeatureCatalogEntry, next: FeatureState, message: string) {
    if (!data) return;
    save({ ...data.settings.features, [entry.key]: next }, message);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">مدیریت بخش‌ها</h1>
        <p className="text-sm text-muted-foreground">
          هر بخش پنل را برای همه یا فقط برای یک نقش روشن و خاموش کنید. بخش خاموش از منو حذف
          می‌شود و سرور هم درخواست‌هایش را رد می‌کند؛ اطلاعات قبلی‌اش پاک نمی‌شود و با روشن‌کردن
          دوباره برمی‌گردد. تغییرات بلافاصله و بدون نیاز به آپلود دوباره اعمال می‌شوند.
        </p>
      </div>

      {data && !data.storageReady && <SettingsStorageNotice />}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState message="دریافت تنظیمات با خطا مواجه شد." />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {data.featureCatalog.map((entry) => (
            <FeatureCard
              key={entry.key}
              entry={entry}
              state={data.settings.features[entry.key] ?? { enabled: true, roles: {} }}
              disabled={update.isPending || !data.storageReady}
              onChange={(next, message) => change(entry, next, message)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FeatureCard({
  entry,
  state,
  disabled,
  onChange,
}: {
  entry: FeatureCatalogEntry;
  state: FeatureState;
  disabled: boolean;
  onChange: (next: FeatureState, message: string) => void;
}) {
  const showRoles = entry.roles.length > 1;

  return (
    <Card className={cn("gap-3 py-4", !state.enabled && "opacity-80")}>
      <div className="flex items-start gap-3 px-5">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            state.enabled ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
          )}
        >
          <ToggleRight className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{entry.label}</p>
          <p className="text-xs leading-5 text-muted-foreground">{entry.description}</p>
        </div>
        <Switch
          checked={state.enabled}
          disabled={disabled}
          aria-label={`${entry.label} برای همه`}
          onCheckedChange={(enabled) =>
            onChange(
              { ...state, enabled },
              enabled ? `«${entry.label}» روشن شد.` : `«${entry.label}» برای همه خاموش شد.`
            )
          }
        />
      </div>

      {showRoles && (
        <div className="flex flex-wrap gap-2 border-t border-border px-5 pt-3">
          {entry.roles.map((role: AccountType) => {
            const on = state.roles[role] !== false;
            return (
              <label
                key={role}
                className={cn(
                  "flex items-center gap-2 rounded-xl border border-border px-3 py-1.5 text-xs",
                  !state.enabled && "text-muted-foreground"
                )}
              >
                <Switch
                  checked={state.enabled && on}
                  disabled={disabled || !state.enabled}
                  onCheckedChange={(checked) =>
                    onChange(
                      { ...state, roles: { ...state.roles, [role]: checked } },
                      checked
                        ? `«${entry.label}» برای ${ROLE_LABEL[role]} روشن شد.`
                        : `«${entry.label}» برای ${ROLE_LABEL[role]} خاموش شد.`
                    )
                  }
                />
                {ROLE_LABEL[role]}
              </label>
            );
          })}
        </div>
      )}
    </Card>
  );
}
