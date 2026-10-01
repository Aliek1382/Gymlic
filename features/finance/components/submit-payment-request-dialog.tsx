"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Wallet, X } from "lucide-react";
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
import { formatToman } from "@/lib/persian";
import { getErrorMessage } from "@/lib/get-error-message";
import {
  checkDiscountCode,
  getBillingInfo,
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

  const { data: billing } = useQuery({
    queryKey: ["finance", "billing-info"],
    queryFn: getBillingInfo,
    enabled: open,
  });

  const form = useForm<PaymentRequestFormInput, unknown, PaymentRequestFormValues>({
    resolver: zodResolver(paymentRequestFormSchema),
    defaultValues: { planId: "", amountToman: 0, referenceNote: "" },
  });
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
    try {
      await submitPaymentRequest({ ...values, discountCode: quote?.code });
      toast.success("درخواست پرداخت ثبت شد و در انتظار تایید مدیریت است.");
      form.reset({ planId: "", amountToman: 0, referenceNote: "" });
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

          <div className="space-y-2">
            <Label htmlFor="payment-reference">توضیح / کد پیگیری (اختیاری)</Label>
            <Input
              id="payment-reference"
              {...form.register("referenceNote")}
              placeholder="مثلاً کد پیگیری واریز بانکی"
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
