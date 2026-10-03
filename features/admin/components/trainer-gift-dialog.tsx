"use client";

import { useState } from "react";
import { Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/get-error-message";
import { parseLocaleNumber } from "@/lib/persian";
import { sendTrainerGiftCode } from "../services/trainer-gift-service";

/**
 * A discount code on a trainer plan that only this trainer can use, once,
 * sent to them as a notification: for their birthday or any other reason.
 */
export function TrainerGiftDialog({
  trainer,
  occasion,
  onClose,
  onSent,
}: {
  trainer: { id: string; name: string } | null;
  occasion: "birthday" | "gift";
  onClose: () => void;
  onSent?: () => void;
}) {
  const [percent, setPercent] = useState("20");
  const [days, setDays] = useState("14");
  const [message, setMessage] = useState(occasion === "birthday" ? "تولدتان مبارک!" : "");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!trainer) return;
    const p = parseLocaleNumber(percent);
    const d = parseLocaleNumber(days);
    if (p === null || !Number.isInteger(p) || p < 1 || p > 100) {
      toast.error("درصد تخفیف باید بین ۱ و ۱۰۰ باشد.");
      return;
    }
    if (d === null || !Number.isInteger(d) || d < 1 || d > 90) {
      toast.error("مدت اعتبار باید بین ۱ و ۹۰ روز باشد.");
      return;
    }
    setSending(true);
    try {
      const result = await sendTrainerGiftCode(trainer.id, { occasion, percent: p, days: d, message: message.trim() });
      toast.success(`کد ${result.code} ساخته و برای ${trainer.name} فرستاده شد.`);
      onClose();
      onSent?.();
    } catch (error) {
      toast.error(getErrorMessage(error, "ارسال هدیه ناموفق بود."));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={!!trainer} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{occasion === "birthday" ? "هدیه‌ی تولد" : "کد تخفیف اختصاصی"} برای {trainer?.name}</DialogTitle>
          <DialogDescription>
            یک کد تخفیف اشتراک ساخته می‌شود که فقط همین مربی، یک بار، می‌تواند استفاده کند و با اعلان برایش
            فرستاده می‌شود.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gift-percent">درصد تخفیف</Label>
              <Input id="gift-percent" dir="ltr" inputMode="numeric" value={percent} onChange={(e) => setPercent(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gift-days">اعتبار (روز)</Label>
              <Input id="gift-days" dir="ltr" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gift-message">
              پیام <span className="text-muted-foreground">(اختیاری)</span>
            </Label>
            <Input id="gift-message" maxLength={200} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={send} disabled={sending}>
            {sending ? <Loader2 className="animate-spin" /> : <Gift />}
            ساخت و ارسال کد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
