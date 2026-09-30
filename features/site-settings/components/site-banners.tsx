"use client";

import { useEffect, useState } from "react";
import { CircleCheck, Construction, Info, TriangleAlert, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthContext } from "@/features/authentication/hooks/use-auth-context";
import { usePublicSettings } from "../hooks/use-site-settings";
import type { AnnouncementTone } from "../services/site-settings-service";
import type { AccountType } from "@/types/database.types";

const DISMISSED_STORAGE_KEY = "gymlic.announcement.dismissed";

const TONE: Record<AnnouncementTone, { icon: typeof Info; className: string }> = {
  info: { icon: Info, className: "border-primary/30 bg-accent text-accent-foreground" },
  warning: { icon: TriangleAlert, className: "border-warning/30 bg-warning-muted text-warning" },
  success: { icon: CircleCheck, className: "border-success/30 bg-success-muted text-success" },
};

function readDismissed(): string | null {
  try {
    return window.localStorage.getItem(DISMISSED_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * The strip above every panel page: the admin's announcement for this role,
 * and — for a platform admin only — a reminder that maintenance mode is on,
 * since the admin is the one person it doesn't lock out.
 */
export function SiteBanners({ accountType }: { accountType: AccountType }) {
  const { announcement, maintenance } = usePublicSettings();
  const { data: context } = useAuthContext();
  // Read after mount: localStorage doesn't exist in the static prerender.
  const [dismissed, setDismissed] = useState<string | null>(null);
  useEffect(() => setDismissed(readDismissed()), []);

  const showAnnouncement =
    announcement.enabled &&
    announcement.message !== "" &&
    announcement.roles[accountType] !== false &&
    dismissed !== announcement.message;

  const tone = TONE[announcement.tone] ?? TONE.info;
  const ToneIcon = tone.icon;

  function dismiss() {
    setDismissed(announcement.message);
    try {
      // Keyed by the text itself, so a new announcement shows again.
      window.localStorage.setItem(DISMISSED_STORAGE_KEY, announcement.message);
    } catch {
      // Unwritable storage: it just reappears on the next visit.
    }
  }

  if (!showAnnouncement && !(maintenance.enabled && context?.isPlatformAdmin)) {
    return null;
  }

  return (
    <div className="mb-4 space-y-3">
      {maintenance.enabled && context?.isPlatformAdmin && (
        <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <Construction className="size-5 shrink-0" />
          <p className="flex-1">
            حالت تعمیر روشن است: جز مدیران، هیچ کاربری به پنل دسترسی ندارد. از
            «تنظیمات سایت» در پنل مدیریت خاموشش کنید.
          </p>
        </div>
      )}

      {showAnnouncement && (
        <div
          role="status"
          className={cn("flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm", tone.className)}
        >
          <ToneIcon className="mt-0.5 size-5 shrink-0" />
          <p className="flex-1 whitespace-pre-line leading-6">{announcement.message}</p>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 rounded-lg p-1 opacity-70 transition-opacity hover:opacity-100"
            aria-label="بستن اطلاعیه"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
