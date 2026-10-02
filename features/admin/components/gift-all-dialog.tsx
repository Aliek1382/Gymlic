"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber, parseLocaleNumber } from "@/lib/persian";
import { giftAllSubscriptions } from "../services/admin-billing-service";

/** Extra days on every club's subscription (e.g. to make up for downtime). */
export function GiftAllDialog({
  open,
  onClose,
  running,
  withSubscription,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  running: number;
  withSubscription: number;
  onDone: () => void;
}) {
  const [days, setDays] = useState("1");
  const [includeExpired, setIncludeExpired] = useState(false);
  const [notify, setNotify] = useState(true);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const value = parseLocaleNumber(days);
    if (value === null || !Number.isInteger(value) || value < 1 || value > 3650) {
      toast.error("تعداد روز باید بین ۱ و ۳۶۵۰ باشد.");
      return;
    }
    setSaving(true);
    try {
      const count = await giftAllSubscriptions({ days: value, includeExpired, notify, note: note.trim() });
      toast.success(`${formatNumber(value)} روز به اشتراک ${formatNumber(count)} باشگاه اضافه شد.`);
      onDone();
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, "افزودن روز هدیه ناموفق بود."));
    } finally {
      setSaving(false);
    }
  }

  const target = includeExpired ? withSubscription : running;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>روز هدیه به همه</DialogTitle>
          <DialogDescription>
            مثلاً برای جبران روزهایی که سایت در دسترس نبود. روزها به انتهای اشتراک هر باشگاه اضافه
            می‌شوند.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gift-all-days">تعداد روز</Label>
            <Input id="gift-all-days" dir="ltr" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <Switch checked={includeExpired} onCheckedChange={setIncludeExpired} className="mt-0.5" />
            <span>
              اشتراک‌های منقضی را هم شامل شود
              <span className="block text-xs text-muted-foreground">
                خاموش: فقط اشتراک‌هایی که هنوز تمام نشده‌اند. روشن: منقضی‌ها از امروز دوباره فعال می‌شوند.
              </span>
            </span>
          </label>
          <div className="space-y-2">
            <Label htmlFor="gift-all-note">
              توضیح <span className="text-muted-foreground">(اختیاری، در متن اعلان)</span>
            </Label>
            <Input
              id="gift-all-note"
              value={note}
              maxLength={500}
              placeholder="مثلاً: بابت قطعی دیروز سایت"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <Switch checked={notify} onCheckedChange={setNotify} />
            به مالک هر باشگاه اعلان بده
          </label>
          <p className="text-sm text-foreground">
            شامل {formatNumber(target)} باشگاه می‌شود.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving || target === 0}>
            {saving && <Loader2 className="animate-spin" />}
            افزودن روز هدیه
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
