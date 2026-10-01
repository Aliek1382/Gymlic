"use client";

import { BadgeCheck, Clock, Loader2, Send, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/get-error-message";
import { useRequestVerification } from "../hooks/use-trainer-resume";
import type { ResumeVerification } from "../types/trainer-resume-types";

/**
 * Inside the certificates card of the résumé editor: where the review for
 * the «مربی تأییدشده» badge stands, and the button that asks for it. Only
 * saved certificates are sent, so the button waits for a save.
 */
export function VerificationPanel({
  verification,
  hasSavedCertificates,
  unsaved,
}: {
  verification: ResumeVerification;
  hasSavedCertificates: boolean;
  unsaved: boolean;
}) {
  const request = useRequestVerification();

  async function send() {
    try {
      await request.mutateAsync();
      toast.success("مدارک برای بررسی فرستاده شد. نتیجه را با اعلان خبر می‌دهیم.");
    } catch (error) {
      toast.error(getErrorMessage(error, "ارسال برای بررسی انجام نشد."));
    }
  }

  if (verification.status === "verified") {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-success-muted px-3 py-2.5 text-sm text-success">
        <BadgeCheck className="mt-0.5 size-4 shrink-0" />
        <p>مدارک شما تأیید شده و نشان «مربی تأییدشده» کنار نامتان برای شاگردان دیده می‌شود.</p>
      </div>
    );
  }
  if (verification.status === "pending") {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-info-muted px-3 py-2.5 text-sm text-info">
        <Clock className="mt-0.5 size-4 shrink-0" />
        <p>مدارک شما در حال بررسی است. نتیجه را با اعلان خبر می‌دهیم.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-border px-3 py-3 text-sm">
      {verification.status === "rejected" && (
        <div className="flex items-start gap-2 text-destructive">
          <XCircle className="mt-0.5 size-4 shrink-0" />
          <p>
            مدارک قبلی تأیید نشد{verification.note ? `: ${verification.note}` : "."} بعد از اصلاح، دوباره بفرستید.
          </p>
        </div>
      )}
      <p className="text-muted-foreground">
        برای گرفتن نشان «مربی تأییدشده»، مدارک ذخیره‌شده را برای بررسی تیم جیم‌لیک بفرستید.
        {unsaved && " اول تغییرات رزومه را ذخیره کنید."}
      </p>
      <Button size="sm" variant="outline" disabled={!hasSavedCertificates || unsaved || request.isPending} onClick={send}>
        {request.isPending ? <Loader2 className="animate-spin" /> : <Send />}
        {verification.status === "rejected" ? "ارسال دوباره برای بررسی" : "ارسال برای بررسی"}
      </Button>
    </div>
  );
}
