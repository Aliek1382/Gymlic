"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2, Wallet } from "lucide-react";
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
import { submitPaymentRequest } from "../services/finance-service";
import {
  paymentRequestFormSchema,
  type PaymentRequestFormInput,
  type PaymentRequestFormValues,
} from "../validators/finance-schemas";

interface Plan {
  id: string;
  name: string;
  priceToman: number;
  durationDays: number;
}

export function SubmitPaymentRequestDialog({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<PaymentRequestFormInput, unknown, PaymentRequestFormValues>({
    resolver: zodResolver(paymentRequestFormSchema),
    defaultValues: { planId: "", amountToman: 0, referenceNote: "" },
  });

  function handlePlanChange(planId: string) {
    form.setValue("planId", planId);
    const plan = plans.find((p) => p.id === planId);
    if (plan) form.setValue("amountToman", plan.priceToman);
  }

  async function onSubmit(values: PaymentRequestFormValues) {
    try {
      await submitPaymentRequest(values);
      toast.success("درخواست پرداخت ثبت شد و در انتظار تایید مدیریت است.");
      form.reset({ planId: "", amountToman: 0, referenceNote: "" });
      setOpen(false);
      router.refresh();
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
      <DialogContent>
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
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} — {formatToman(plan.priceToman)} تومان
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
