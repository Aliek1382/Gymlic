"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GymlicMark } from "@/components/brand/gymlic-mark";

const DISMISSED_KEY = "gymlic:install-prompt-dismissed-at";
// Dismissing hides the prompt for a fortnight rather than for good: someone
// who says "not now" on a borrowed phone shouldn't lose the entry point.
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

type Platform = "android" | "desktop" | "ios" | null;

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari's own flag, which predates display-mode and is still what an
    // installed iOS web app reports.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isAndroid() {
  return /Android/i.test(window.navigator.userAgent);
}

function isIos() {
  const ua = window.navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports itself as a Mac; the touch points give it away.
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1)
  );
}

function wasDismissedRecently() {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < SNOOZE_MS;
  } catch {
    // Private mode and blocked site data both throw here. Showing the prompt
    // is the harmless side of that failure.
    return false;
  }
}

export function InstallAppPrompt() {
  const [platform, setPlatform] = useState<Platform>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showAndroidNote, setShowAndroidNote] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasDismissedRecently()) return;

    if (isIos()) {
      setPlatform("ios");
      return;
    }

    // Chrome fires beforeinstallprompt once, and often before React has
    // hydrated. The inline script in the root layout catches it and parks it
    // on window, so this reads whatever already arrived and then listens for
    // the rest.
    const installable = isAndroid() ? "android" : "desktop";
    if (window.__gymlicInstallPrompt) {
      setPlatform(installable);
    }
    const onAvailable = () => setPlatform(installable);
    const onInstalled = () => setPlatform(null);

    window.addEventListener("gymlic:installavailable", onAvailable);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("gymlic:installavailable", onAvailable);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    setPlatform(null);
    try {
      window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // Nothing to do: the prompt is gone for this session either way.
    }
  }, []);

  const install = useCallback(async () => {
    const deferred = window.__gymlicInstallPrompt;
    if (!deferred) return;

    // Closing first keeps our dialog from sitting behind Chrome's. prompt()
    // still counts as user-activated: the tap that ran this handler is the
    // gesture, and closing a dialog doesn't consume it.
    setShowAndroidNote(false);

    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // The event is single-use; Chrome fires a fresh one if the user declines
    // and later becomes eligible again.
    window.__gymlicInstallPrompt = null;
    if (outcome === "accepted") {
      setPlatform(null);
    } else {
      dismiss();
    }
  }, [dismiss]);

  if (!platform) return null;

  return (
    <>
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <GymlicMark className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">نصب اپلیکیشن</p>
          <p className="text-xs leading-5 text-muted-foreground">
            دسترسی سریع‌تر، بدون باز کردن مرورگر
          </p>
        </div>

        {/* One label for both platforms: iOS has no install API, so the same
            tap opens step-by-step instructions instead of a system prompt. */}
        <Button
          size="sm"
          className="shrink-0"
          onClick={
            platform === "ios"
              ? () => setShowIosGuide(true)
              : platform === "android"
                ? () => setShowAndroidNote(true)
                : install
          }
        >
          <Download />
          نصب
        </Button>

        <button
          type="button"
          onClick={dismiss}
          aria-label="بستن"
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Android gets a step in front of Chrome's own dialog purely to carry
          the VPN note. Minting a WebAPK needs Google's servers, and when they
          are unreachable Chrome falls back to a shortcut without saying so —
          the user is left with a home-screen icon that never reaches the app
          drawer and no clue why. */}
      <Dialog open={showAndroidNote} onOpenChange={setShowAndroidNote}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>قبل از نصب</DialogTitle>
            <DialogDescription>
              برای نصب جیم‌لیک روی اندروید، یک نکته را در نظر داشته باشید.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded-xl bg-muted p-3 text-sm leading-7 text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">
                فیلترشکن (VPN) خود را روشن کنید.
              </span>{" "}
              اندروید برای ساخت اپ یک‌بار به سرورهای گوگل وصل می‌شود؛ بدون آن
              به‌جای اپ فقط یک میان‌بر ساخته می‌شود که در لیست برنامه‌ها دیده
              نمی‌شود.
            </p>
            <p>
              <span className="font-semibold text-foreground">
                پس از نصب دیگر به فیلترشکن نیازی نیست.
              </span>{" "}
              اپ نصب‌شده مستقیم و بدون واسطه کار می‌کند.
            </p>
          </div>

          <Button onClick={install} className="w-full">
            <Download />
            ادامه و نصب
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={showIosGuide} onOpenChange={setShowIosGuide}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>نصب روی آیفون</DialogTitle>
            <DialogDescription>
              سافاری دکمه‌ی نصب خودکار ندارد، اما در سه مرحله می‌توانید جیم‌لیک
              را به صفحه‌ی اصلی اضافه کنید.
            </DialogDescription>
          </DialogHeader>

          <ol className="space-y-4">
            <IosStep
              number={1}
              icon={<Share className="size-4" />}
              text="دکمه‌ی هم‌رسانی (Share) را در نوار پایین سافاری بزنید."
            />
            <IosStep
              number={2}
              icon={<SquarePlus className="size-4" />}
              text="در فهرست باز شده، گزینه‌ی «Add to Home Screen» را انتخاب کنید."
            />
            <IosStep number={3} text="روی «Add» بزنید تا آیکون اضافه شود." />
          </ol>

          <div className="space-y-2 rounded-xl bg-muted p-3 text-xs leading-6 text-muted-foreground">
            <p>
              اگر این گزینه را نمی‌بینید، صفحه را در مرورگر سافاری باز کنید؛ در
              سایر مرورگرهای آیفون در دسترس نیست.
            </p>
            <p>
              پس از نصب یک‌بار دیگر وارد حساب خود شوید. اپ نصب‌شده حافظه‌ای جدا
              از مرورگر دارد و ورود قبلی شما را نمی‌شناسد.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function IosStep({
  number,
  icon,
  text,
}: {
  number: number;
  icon?: React.ReactNode;
  text: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-accent-foreground">
        {number}
      </span>
      {/* Rendered even when empty so every step's text starts on the same
          line, instead of the icon-less step hanging left of the others. */}
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-muted-foreground">
        {icon}
      </span>
      <span className="flex-1 text-sm leading-6 text-foreground">{text}</span>
    </li>
  );
}
