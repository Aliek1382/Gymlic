"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNumber } from "@/lib/persian";
import { getErrorMessage } from "@/lib/get-error-message";
import { useAthletes } from "@/features/athletes";
import { useAddTrainerPayment } from "../hooks/use-add-trainer-payment";
import { useUpdateTrainerPayment } from "../hooks/use-update-trainer-payment";
import type { TrainerPayment, TrainerPaymentInput } from "../types/earnings-types";
import {
  normalizeAmount,
  trainerPaymentFormSchema,
  type TrainerPaymentFormValues,
} from "../validators/earnings-schemas";
import { todayIso } from "../utils/iso-date";
import { JalaliDateField } from "./jalali-date-field";

function toInput(values: TrainerPaymentFormValues): TrainerPaymentInput {
  return {
    athleteId: values.athleteId,
    amountToman: Number(normalizeAmount(values.amountToman)),
    paidAt: values.paidAt,
    note: values.note?.trim() || null,
  };
}

export function PaymentFormDialog({ payment }: { payment?: TrainerPayment }) {
  const [open, setOpen] = useState(false);
  // The athlete list is only needed once the dialog is open — no reason to
  // fetch it behind every row's edit button on the ledger.
  const athletes = useAthletes({ enabled: open });
  const addPayment = useAddTrainerPayment();
  const updatePayment = useUpdateTrainerPayment();
  const isEdit = Boolean(payment);
  const isPending = addPayment.isPending || updatePayment.isPending;

  const form = useForm<TrainerPaymentFormValues>({
    resolver: zodResolver(trainerPaymentFormSchema),
    defaultValues: { athleteId: "", amountToman: "", paidAt: todayIso(), note: "" },
  });

  // Re-seed on every open rather than only at mount: "add" should come back
  // blank and dated today even after a previous submit, and "edit" should
  // load that specific payment.
  useEffect(() => {
    if (!open) return;
    form.reset({
      athleteId: payment?.athleteId ?? "",
      amountToman: payment ? String(payment.amountToman) : "",
      paidAt: payment?.paidAt ?? todayIso(),
      note: payment?.note ?? "",
    });
  }, [open, payment, form]);

  // useAthletes only returns currently active athletes. Editing a payment
  // from someone who has since left would otherwise show an empty select,
  // so carry that athlete's stored name into the options.
  const activeAthletes = athletes.data ?? [];
  const athleteOptions =
    payment?.athleteId && !activeAthletes.some((a) => a.id === payment.athleteId)
      ? [...activeAthletes, { id: payment.athleteId, name: payment.athleteName }]
      : activeAthletes;

  const amountValue = form.watch("amountToman");
  const normalizedAmount = normalizeAmount(amountValue ?? "");
  const amountPreview = /^\d+$/.test(normalizedAmount)
    ? formatNumber(Number(normalizedAmount))
    : null;

  async function onSubmit(values: TrainerPaymentFormValues) {
    try {
      const input = toInput(values);
      if (isEdit && payment) {
        await updatePayment.mutateAsync({ id: payment.id, input });
        toast.success("پرداخت ویرایش شد.");
      } else {
        await addPayment.mutateAsync(input);
        toast.success("پرداخت جدید ثبت شد.");
      }
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "ثبت پرداخت با خطا مواجه شد."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isEdit ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 shrink-0 text-muted-foreground"
          aria-label="ویرایش پرداخت"
          onClick={() => setOpen(true)}
        >
          <Pencil className="size-4" />
        </Button>
      ) : (
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus />
          ثبت پرداخت جدید
        </Button>
      )}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "ویرایش پرداخت" : "ثبت پرداخت جدید"}
          </DialogTitle>
          <DialogDescription>
            شهریه‌ای که از یک شاگرد دریافت کرده‌اید را ثبت کنید تا در درآمد
            شما محاسبه شود. این اطلاعات فقط برای خودتان قابل مشاهده است.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="payment-athlete">شاگرد</Label>
            <Controller
              control={form.control}
              name="athleteId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={athletes.isLoading || athletes.isError}
                >
                  <SelectTrigger id="payment-athlete" className="w-full">
                    <SelectValue
                      placeholder={
                        athletes.isLoading
                          ? "در حال بارگذاری…"
                          : athletes.isError
                            ? "خطا در دریافت فهرست شاگردان"
                            : "یک شاگرد را انتخاب کنید"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {athleteOptions.map((athlete) => (
                      <SelectItem key={athlete.id} value={athlete.id}>
                        {athlete.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.athleteId && (
              <p className="text-xs text-destructive">
                {form.formState.errors.athleteId.message}
              </p>
            )}
            {!athletes.isLoading &&
              !athletes.isError &&
              athleteOptions.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  هنوز شاگردی ندارید. ابتدا از بخش «ورزشکاران» یک شاگرد اضافه
                  کنید.
                </p>
              )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-amount">مبلغ (تومان)</Label>
            <Input
              id="payment-amount"
              inputMode="numeric"
              className="text-center"
              {...form.register("amountToman")}
            />
            {form.formState.errors.amountToman ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.amountToman.message}
              </p>
            ) : (
              amountPreview && (
                <p className="text-xs text-muted-foreground">
                  {amountPreview} تومان
                </p>
              )
            )}
          </div>

          <Controller
            control={form.control}
            name="paidAt"
            render={({ field }) => (
              <JalaliDateField
                id="payment-paid-at"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />

          <div className="space-y-2">
            <Label htmlFor="payment-note">
              یادداشت <span className="text-muted-foreground">(اختیاری)</span>
            </Label>
            <Input
              id="payment-note"
              placeholder="مثلاً: شهریه مرداد"
              {...form.register("note")}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" />}
            {isEdit ? "ذخیره تغییرات" : "ثبت پرداخت"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
