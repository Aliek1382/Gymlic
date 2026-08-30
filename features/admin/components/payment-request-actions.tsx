"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/get-error-message";
import { approvePaymentRequest, rejectPaymentRequest } from "../services/admin-service";

export function PaymentRequestActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function close() {
    setMode(null);
    setNote("");
  }

  async function submit() {
    if (!mode) return;
    setIsSubmitting(true);
    try {
      if (mode === "approve") {
        await approvePaymentRequest(requestId, note);
        toast.success("درخواست تایید و اشتراک باشگاه فعال شد.");
      } else {
        await rejectPaymentRequest(requestId, note);
        toast.success("درخواست رد شد.");
      }
      close();
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, "خطا در ثبت تصمیم."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => setMode("approve")}>
          <Check />
          تایید
        </Button>
        <Button size="sm" variant="destructive" onClick={() => setMode("reject")}>
          <X />
          رد
        </Button>
      </div>

      <Dialog open={mode !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "approve" ? "تایید درخواست پرداخت" : "رد درخواست پرداخت"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="payment-request-note">یادداشت (اختیاری)</Label>
            <Input
              id="payment-request-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                mode === "approve"
                  ? "مثلاً کد پیگیری تراکنش"
                  : "دلیل رد درخواست"
              }
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={isSubmitting}>
              انصراف
            </Button>
            <Button
              variant={mode === "reject" ? "destructive" : "default"}
              onClick={submit}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="animate-spin" />}
              {mode === "approve" ? "تایید و فعال‌سازی" : "رد درخواست"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
