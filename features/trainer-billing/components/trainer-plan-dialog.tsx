"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus } from "lucide-react";
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
import { toAsciiDigits } from "@/lib/persian";
import {
  createTrainerPlan,
  updateTrainerPlan,
  type TrainerPlan,
} from "../services/trainer-billing-service";

const digits = (value: string) => toAsciiDigits(value).replace(/\D+/g, "");

/** Create or edit a trainer plan (the admin's catalogue, separate from the clubs'). */
export function TrainerPlanDialog({ plan }: { plan?: TrainerPlan }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(plan?.name ?? "");
  const [price, setPrice] = useState(plan ? String(plan.price_toman) : "");
  const [days, setDays] = useState(plan ? String(plan.duration_days) : "30");
  const [cap, setCap] = useState(plan?.max_athletes != null ? String(plan.max_athletes) : "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const priceToman = Number(digits(price));
    const durationDays = Number(digits(days));
    if (!name.trim()) {
      toast.error("نام پلن را وارد کنید.");
      return;
    }
    if (!digits(price) || !Number.isInteger(priceToman)) {
      toast.error("قیمت را به تومان وارد کنید.");
      return;
    }
    if (!durationDays || durationDays > 3650) {
      toast.error("مدت باید بین ۱ و ۳۶۵۰ روز باشد.");
      return;
    }
    const maxAthletes = digits(cap) ? Number(digits(cap)) : null;

    setSaving(true);
    try {
      const input = { name: name.trim(), priceToman, durationDays, maxAthletes };
      if (plan) {
        await updateTrainerPlan(plan.id, input);
        toast.success("پلن به‌روزرسانی شد.");
      } else {
        await createTrainerPlan(input);
        toast.success("پلن ساخته شد.");
        setName("");
        setPrice("");
        setDays("30");
        setCap("");
      }
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["admin", "trainer-plans"] });
      void queryClient.invalidateQueries({ queryKey: ["trainer-billing"] });
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیرهٔ پلن ناموفق بود."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {plan ? (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Pencil />
          ویرایش
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus />
          پلن جدید
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{plan ? "ویرایش پلن مربی" : "پلن جدید برای مربیان"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tp-name">نام پلن</Label>
              <Input id="tp-name" maxLength={255} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tp-price">قیمت (تومان)</Label>
                <Input
                  id="tp-price"
                  dir="ltr"
                  inputMode="numeric"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tp-days">مدت (روز)</Label>
                <Input
                  id="tp-days"
                  dir="ltr"
                  inputMode="numeric"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tp-cap">
                سقف ورزشکار <span className="text-muted-foreground">(خالی = نامحدود)</span>
              </Label>
              <Input
                id="tp-cap"
                dir="ltr"
                inputMode="numeric"
                className="w-32"
                value={cap}
                onChange={(e) => setCap(e.target.value)}
              />
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              تغییر قیمت یا سقف، اشتراک‌های فعلی را عوض نمی‌کند؛ از تمدید بعدی اعمال می‌شود.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              ذخیره
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
