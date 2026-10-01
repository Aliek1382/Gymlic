"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Paperclip, Wallet, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatToman, toAsciiDigits } from "@/lib/persian";
import { getErrorMessage } from "@/lib/get-error-message";
import {
  checkDiscountCode,
  getBillingInfo,
  prepareReceipt,
  submitPaymentRequest,
  type DiscountQuote,
} from "../services/finance-service";
import {
  paymentRequestFormSchema,
  type PaymentRequestFormInput,
  type PaymentRequestFormValues,
} from "../validators/finance-schemas";
import { PaymentInfoCard } from "./payment-info-card";

interface Plan {
  id: string;
  name: string;
  priceToman: number;
  durationDays: number;
}

export function SubmitPaymentRequestDialog({ plans }: { plans: Plan[] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [quote, setQuote] = useState<DiscountQuote | null>(null);
  const [checking, setChecking] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);

  const { data: billing } = useQuery({
    queryKey: ["finance", "billing-info"],
    queryFn: getBillingInfo,
    enabled: open,
  });

  const form = useForm<PaymentRequestFormInput, unknown, PaymentRequestFormValues>({
    resolver: zodResolver(paymentRequestFormSchema),
    defaultValues: {
      planId: "",
      amountToman: 0,
      referenceNote: "",
      trackingCode: "",
      cardLast4: "",
      paidAt: "",
    },
  });
  const rules = billing?.receipts ?? null;
  const planId = form.watch("planId");
  const plan = plans.find((p) => p.id === planId);

  function clearDiscount() {
    setQuote(null);
    if (plan) form.setValue("amountToman", plan.priceToman);
  }

  function handlePlanChange(nextPlanId: string) {
    form.setValue("planId", nextPlanId);
    const next = plans.find((p) => p.id === nextPlanId);
    if (next) form.setValue("amountToman", next.priceToman);
    // A code is priced for one plan; picking another means checking it again.
    setQuote(null);
  }

  async function applyCode() {
    if (!plan) {
      toast.error("اول پلن را انتخاب کنید.");
      return;
    }
    if (!code.trim()) return;
    setChecking(true);
    try {
      const result = await checkDiscountCode(plan.id, code.trim());
      setQuote(result);
      form.setValue("amountToman", result.final_toman);
      toast.success("کد تخفیف اعمال شد.");
    } catch (error) {
      setQuote(null);
      toast.error(getErrorMessage(error, "بررسی کد تخفیف ناموفق بود."));
    } finally {
      setChecking(false);
    }
  }

  async function onSubmit(values: PaymentRequestFormValues) {
    // Zero is only right when a code covers the whole price.
    if (values.amountToman === 0 && quote?.final_toman !== 0) {
      form.setError("amountToman", { message: "مبلغ را وارد کنید." });
      return;
    }

    // The rules come from the server; before its database update there is
    // nothing to ask for and the request goes as it always did.
    const trackingCode = toAsciiDigits(values.trackingCode ?? "").replace(/\s+/g, "");
    const cardLast4 = toAsciiDigits(values.cardLast4 ?? "").trim();
    if (rules) {
      if (!/^[A-Za-z0-9_/-]{4,40}$/.test(trackingCode)) {
        form.setError("trackingCode", { message: "کد پیگیری باید بین ۴ تا ۴۰ حرف یا رقم باشد." });
        return;
      }
      if (!/^\d{4}$/.test(cardLast4)) {
        form.setError("cardLast4", { message: "چهار رقم آخر کارت را وارد کنید." });
        return;
      }
      if (rules.required && !receipt) {
        toast.error("تصویر یا فایل رسید پرداخت را پیوست کنید.");
        return;
      }
    }

    try {
      const prepared = rules && receipt ? await prepareReceipt(receipt) : null;
      if (prepared && prepared.size > rules!.max_mb * 1024 * 1024) {
        toast.error(`حجم رسید باید حداکثر ${rules!.max_mb} مگابایت باشد.`);
        return;
      }
      await submitPaymentRequest({
        ...values,
        trackingCode: rules ? trackingCode : undefined,
        cardLast4: rules ? cardLast4 : undefined,
        paidAt: rules ? values.paidAt : undefined,
        receipt: prepared,
        discountCode: quote?.code,
      });
      toast.success("درخواست پرداخت ثبت شد و در انتظار تایید مدیریت است.");
      form.reset({
        planId: "",
        amountToman: 0,
        referenceNote: "",
        trackingCode: "",
        cardLast4: "",
        paidAt: "",
      });
      setReceipt(null);
      setCode("");
      setQuote(null);
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
    } catch (error) {
      toast.error(getErrorMessage(error, "ثبت درخواست با خطا مواجه شد."));
    }
  }

  if (plans.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Wallet />
          ثبت درخواست پرداخت
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ثبت درخواست پرداخت اشتراک</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>پلن</Label>
            <Controller
              control={form.control}
              name="planId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={handlePlanChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="یک پلن را انتخاب کنید" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {formatToman(p.priceToman)} تومان
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.planId && (
              <p className="text-xs text-destructive">
                {form.formState.errors.planId.message}
              </p>
            )}
          </div>

          {billing?.discounts_enabled && (
            <div className="space-y-2">
              <Label htmlFor="payment-discount">
                کد تخفیف <span className="text-muted-foreground">(اگر دارید)</span>
              </Label>
              {quote ? (
                <div className="space-y-1 rounded-xl border border-success/30 bg-success-muted px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      کد <span dir="ltr" className="font-mono font-medium">{quote.code}</span> اعمال شد
                    </span>
                    <Button type="button" size="icon" variant="ghost" onClick={clearDiscount} aria-label="حذف کد تخفیف">
                      <X />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="line-through">{formatToman(quote.list_price_toman)}</span> ←{" "}
                    <span className="font-medium text-foreground">{formatToman(quote.final_toman)} تومان</span>{" "}
                    ({formatToman(quote.discount_toman)} تومان تخفیف)
                  </p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    id="payment-discount"
                    dir="ltr"
                    value={code}
                    maxLength={40}
                    className="font-mono uppercase"
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void applyCode();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={applyCode} disabled={checking || !code.trim()}>
                    {checking && <Loader2 className="animate-spin" />}
                    اعمال
                  </Button>
                </div>
              )}
            </div>
          )}

          <PaymentInfoCard info={billing?.payment} />

          <div className="space-y-2">
            <Label htmlFor="payment-amount">مبلغ واریزی (تومان)</Label>
            <Input
              id="payment-amount"
              type="number"
              dir="ltr"
              {...form.register("amountToman")}
            />
            {form.formState.errors.amountToman && (
              <p className="text-xs text-destructive">
                {form.formState.errors.amountToman.message}
              </p>
            )}
          </div>

          {rules && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="payment-tracking">کد پیگیری واریز</Label>
                  <Input
                    id="payment-tracking"
                    dir="ltr"
                    inputMode="text"
                    maxLength={40}
                    autoComplete="off"
                    {...form.register("trackingCode")}
                  />
                  {form.formState.errors.trackingCode && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.trackingCode.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-last4">چهار رقم آخر کارت شما</Label>
                  <Input
                    id="payment-last4"
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={4}
                    autoComplete="off"
                    {...form.register("cardLast4")}
                  />
                  {form.formState.errors.cardLast4 && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.cardLast4.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-receipt">
                  تصویر رسید{" "}
                  <span className="text-muted-foreground">
                    {rules.required ? "(الزامی)" : "(اختیاری)"}
                  </span>
                </Label>
                <label
                  htmlFor="payment-receipt"
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-input px-4 py-3 text-sm text-muted-foreground hover:bg-accent"
                >
                  <Paperclip className="size-4 shrink-0" />
                  <span className="truncate">{receipt ? receipt.name : "انتخاب عکس یا فایل PDF"}</span>
                </label>
                <input
                  id="payment-receipt"
                  type="file"
                  accept="image/*,application/pdf"
                  className="sr-only"
                  onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">
                  عکس قبل از ارسال کوچک می‌شود. حداکثر {rules.max_mb} مگابایت
                  {rules.retention_days > 0
                    ? `؛ فایل ${rules.retention_days} روز پس از بررسی درخواست حذف می‌شود.`
                    : "."}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-paid-at">
                  زمان واریز <span className="text-muted-foreground">(اختیاری)</span>
                </Label>
                <Input
                  id="payment-paid-at"
                  type="datetime-local"
                  dir="ltr"
                  {...form.register("paidAt")}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="payment-reference">
              {rules ? "توضیح" : "توضیح / کد پیگیری"} (اختیاری)
            </Label>
            <Input
              id="payment-reference"
              {...form.register("referenceNote")}
              placeholder={rules ? "هر توضیحی که برای بررسی لازم است" : "مثلاً کد پیگیری واریز بانکی"}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            پس از ثبت، مدیریت جیم‌لیک درخواست شما را بررسی و در صورت تایید،
            اشتراک باشگاه را فعال می‌کند.
          </p>

          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
              ثبت درخواست
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
