"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getErrorMessage } from "@/lib/get-error-message";
import { IosInstallGuide } from "./ios-install-guide";
import {
  disablePush,
  enablePush,
  getPushStatus,
  sendTestPush,
  type PushStatus,
} from "../services/push-service";

const HINT: Partial<Record<PushStatus, string>> = {
  unsupported: "این مرورگر از اعلان پشتیبانی نمی‌کند.",
  "ios-install": "در آیفون، اعلان فقط برای برنامه‌ای کار می‌کند که روی صفحهٔ اصلی گوشی نصب شده باشد. راهنمای نصب را ببینید.",
  denied: "اعلان برای این سایت در مرورگر مسدود شده است. از تنظیمات مرورگر اجازه را فعال کنید.",
  off: "یادآوری‌ها را روی گوشی یا کامپیوتر به‌صورت اعلان دریافت کنید، حتی وقتی سایت بسته است.",
  on: "اعلان‌ها روی این دستگاه فعال است.",
};

/** Turns browser/system notifications on or off for the current device. */
export function PushToggle() {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPushStatus()
      .then((next) => !cancelled && setStatus(next))
      .catch(() => !cancelled && setStatus("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(action: () => Promise<void>, success: string, failure: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      setStatus(await getPushStatus());
    } catch (error) {
      toast.error(getErrorMessage(error, failure));
      setStatus(await getPushStatus().catch(() => "unsupported" as const));
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") return null;

  return (
    <Card className="flex-row flex-wrap items-center justify-between gap-3 p-4">
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-medium text-foreground">اعلان روی گوشی و سیستم</p>
          <p className="text-xs text-muted-foreground">{HINT[status]}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {status === "off" && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => run(enablePush, "اعلان روی این دستگاه فعال شد.", "فعال‌سازی اعلان با خطا مواجه شد.")}
          >
            {busy && <Loader2 className="animate-spin" />}
            فعال‌سازی اعلان
          </Button>
        )}
        {status === "on" && (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => run(sendTestPush, "اعلان آزمایشی ارسال شد.", "ارسال اعلان آزمایشی با خطا مواجه شد.")}
            >
              اعلان آزمایشی
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => run(disablePush, "اعلان روی این دستگاه غیرفعال شد.", "غیرفعال‌سازی با خطا مواجه شد.")}
            >
              غیرفعال‌سازی
            </Button>
          </>
        )}
      </div>

      {status === "ios-install" && <IosInstallGuide />}
    </Card>
  );
}
