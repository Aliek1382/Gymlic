"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { toPersianDigits } from "@/lib/persian";
import { isIosNonSafari } from "../services/push-service";

/** Safari's Share button: a box with an arrow leaving its top. */
function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M7 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1" />
    </svg>
  );
}

/** The "Add to Home Screen" row's square-with-plus. */
function AddToHomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function Step({ number, children }: { number: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {toPersianDigits(number)}
      </span>
      <div className="flex-1 text-sm leading-6 text-foreground">{children}</div>
    </li>
  );
}

/** Step-by-step for putting the site on an iPhone's home screen, the only way iOS delivers push. */
export function IosInstallGuide() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrongBrowser = isIosNonSafari();

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("لینک کپی شد. آن را در Safari باز کنید.");
    } catch {
      toast.error("کپی انجام نشد. آدرس صفحه را دستی در Safari باز کنید.");
    }
  }

  return (
    <div className="w-full space-y-3 border-t border-border pt-3">
      <Button size="sm" variant="outline" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? "بستن راهنما" : "راهنمای نصب روی آیفون"}
      </Button>

      {open && (
        <div className="space-y-3">
          <ol className="space-y-3">
            {wrongBrowser && (
              <Step number={1}>
                این صفحه را در <strong>Safari</strong> باز کنید؛ نصب فقط از Safari ممکن است.
                <div className="mt-2">
                  <Button size="sm" variant="secondary" onClick={copyLink}>
                    {copied ? <Check /> : <Copy />}
                    کپی لینک صفحه
                  </Button>
                </div>
              </Step>
            )}
            <Step number={wrongBrowser ? 2 : 1}>
              در Safari، دکمهٔ <strong>اشتراک‌گذاری (Share)</strong> را در پایین صفحه بزنید{" "}
              <span className="inline-flex translate-y-1 rounded-md border border-border px-1.5 py-0.5 text-primary">
                <ShareIcon />
              </span>
            </Step>
            <Step number={wrongBrowser ? 3 : 2}>
              منو را کمی بالا بکشید و <strong>Add to Home Screen</strong> (افزودن به صفحهٔ اصلی) را بزنید{" "}
              <span className="inline-flex translate-y-1 rounded-md border border-border px-1.5 py-0.5 text-primary">
                <AddToHomeIcon />
              </span>
              ، سپس <strong>Add</strong> بالای صفحه.
            </Step>
            <Step number={wrongBrowser ? 4 : 3}>
              از <strong>Safari خارج شوید</strong> و جیم‌لیک را از آیکونی که روی صفحهٔ اصلی گوشی ساخته شد باز کنید.
            </Step>
            <Step number={wrongBrowser ? 5 : 4}>
              در همان برنامه <strong>دوباره وارد حساب شوید</strong> (برنامهٔ نصب‌شده از Safari جداست)، به تقویم بروید و
              «فعال‌سازی اعلان» را بزنید. وقتی iOS پرسید، <strong>Allow</strong> را انتخاب کنید.
            </Step>
          </ol>
          <p className="text-xs text-muted-foreground">
            به iOS نسخهٔ ۱۶٫۴ یا بالاتر نیاز است. اگر «Add to Home Screen» را نمی‌بینید، گوشی را به‌روزرسانی کنید.
          </p>
        </div>
      )}
    </div>
  );
}
