"use client";

import { useState } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber, normalizeAmount } from "@/lib/persian";
import { MAX_PACKAGE_SESSIONS } from "../constants";
import { useCreateSessionPackage } from "../hooks/use-create-session-package";

const EMPTY_FORM = { title: "", total: "", price: "", discount: "" };

/** Sells an athlete a block of private sessions; the invoice is issued with it. */
export function SellPackageDialog({ athleteId }: { athleteId: string }) {
  const createPackage = useCreateSessionPackage();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const set = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: e.target.value }));

  const price = Number(normalizeAmount(form.price));
  const discount = form.discount.trim() === "" ? 0 : Number(normalizeAmount(form.discount));
  const payable = Number.isFinite(price) && Number.isFinite(discount) ? price - discount : NaN;

  async function handleSubmit() {
    const total = Number(normalizeAmount(form.total));
    const title = form.title.trim();

    if (!title) {
      toast.error("عنوان پکیج را وارد کنید.");
      return;
    }
    if (!Number.isInteger(total) || total < 1 || total > MAX_PACKAGE_SESSIONS) {
      toast.error(`تعداد جلسات باید عددی صحیح بین ۱ تا ${formatNumber(MAX_PACKAGE_SESSIONS)} باشد.`);
      return;
    }
    if (!Number.isInteger(price) || price <= 0 || !Number.isInteger(discount) || discount < 0) {
      toast.error("قیمت و تخفیف را به‌صورت عدد صحیح (تومان) وارد کنید.");
      return;
    }
    if (discount >= price) {
      toast.error("تخفیف باید کمتر از قیمت باشد.");
      return;
    }

    try {
      await createPackage.mutateAsync({
        athleteId,
        title,
        totalSessions: total,
        priceToman: price,
        discountToman: discount,
      });
      toast.success("پکیج ثبت و فاکتور آن صادر شد. بعد از ثبت پرداخت، جلسات ساخته می‌شوند.");
      setOpen(false);
      setForm(EMPTY_FORM);
    } catch (error) {
      toast.error(getErrorMessage(error, "ثبت پکیج با خطا مواجه شد."));
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <CalendarPlus />
        فروش پکیج جلسه
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>فروش پکیج جلسه‌ی خصوصی</DialogTitle>
            <DialogDescription>
              با ثبت پکیج یک فاکتور برای ورزشکار صادر می‌شود. جلسات بعد از ثبت پرداخت ساخته می‌شوند.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="package-title">عنوان</Label>
              <Input
                id="package-title"
                value={form.title}
                onChange={set("title")}
                placeholder="مثلاً ۱۰ جلسه تمرین خصوصی"
                maxLength={255}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="package-total">تعداد جلسات</Label>
              <Input
                id="package-total"
                inputMode="numeric"
                value={form.total}
                onChange={set("total")}
                placeholder="۱۰"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="package-price">قیمت (تومان)</Label>
                <Input
                  id="package-price"
                  inputMode="numeric"
                  value={form.price}
                  onChange={set("price")}
                  placeholder="۵٬۰۰۰٬۰۰۰"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="package-discount">تخفیف (تومان)</Label>
                <Input
                  id="package-discount"
                  inputMode="numeric"
                  value={form.discount}
                  onChange={set("discount")}
                  placeholder="اختیاری"
                />
              </div>
            </div>
            {Number.isFinite(payable) && payable > 0 && (
              <p className="text-sm text-muted-foreground">
                مبلغ فاکتور: {formatNumber(payable)} تومان
              </p>
            )}
          </div>

          <Button onClick={handleSubmit} disabled={createPackage.isPending}>
            {createPackage.isPending && <Loader2 className="animate-spin" />}
            ثبت پکیج و صدور فاکتور
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
