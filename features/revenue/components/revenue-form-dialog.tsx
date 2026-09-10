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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { JalaliDateField } from "@/components/ui/jalali-date-field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { todayIso } from "@/lib/iso-date";
import { formatNumber, normalizeAmount } from "@/lib/persian";
import { getErrorMessage } from "@/lib/get-error-message";
import { useClubMembers } from "@/features/members";
import {
  NO_MEMBER_VALUE,
  REVENUE_CATEGORY_LABEL,
  REVENUE_CATEGORY_VALUES,
} from "../constants/revenue";
import { useAddRevenueEntry } from "../hooks/use-add-revenue-entry";
import { useUpdateRevenueEntry } from "../hooks/use-update-revenue-entry";
import type { RevenueEntry, RevenueEntryInput } from "../types/revenue-types";
import {
  revenueEntryFormSchema,
  type RevenueEntryFormValues,
} from "../validators/revenue-schemas";

function toInput(values: RevenueEntryFormValues): RevenueEntryInput {
  return {
    memberId:
      values.memberId && values.memberId !== NO_MEMBER_VALUE
        ? values.memberId
        : null,
    amount: Number(normalizeAmount(values.amount)),
    category: values.category,
    occurredOn: values.occurredOn,
    note: values.note?.trim() || null,
  };
}

function toDefaults(entry?: RevenueEntry): RevenueEntryFormValues {
  return {
    memberId: entry?.memberId ?? NO_MEMBER_VALUE,
    amount: entry ? String(entry.amount) : "",
    category: entry?.category ?? "membership",
    occurredOn: entry?.occurredOn ?? todayIso(),
    note: entry?.note ?? "",
  };
}

/** Records a new entry, or edits an existing one when `entry` is given. */
export function RevenueFormDialog({
  clubId,
  entry,
}: {
  clubId: string;
  entry?: RevenueEntry;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = !!entry;
  const members = useClubMembers(clubId);
  const addEntry = useAddRevenueEntry(clubId);
  const updateEntry = useUpdateRevenueEntry();

  const form = useForm<RevenueEntryFormValues>({
    resolver: zodResolver(revenueEntryFormSchema),
    defaultValues: toDefaults(entry),
  });

  const { reset } = form;
  useEffect(() => {
    if (open) reset(toDefaults(entry));
  }, [open, entry, reset]);

  const amountValue = form.watch("amount");
  const normalizedAmount = normalizeAmount(amountValue ?? "");
  const isPending = addEntry.isPending || updateEntry.isPending;

  async function onSubmit(values: RevenueEntryFormValues) {
    try {
      if (isEdit) {
        await updateEntry.mutateAsync({ id: entry.id, input: toInput(values) });
        toast.success("دریافتی به‌روزرسانی شد.");
      } else {
        await addEntry.mutateAsync(toInput(values));
        toast.success("دریافتی ثبت شد.");
      }
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "ثبت دریافتی با خطا مواجه شد."));
    }
  }

  const memberOptions = members.data ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isEdit ? (
        <Button
          size="icon"
          variant="ghost"
          aria-label={`ویرایش دریافتی ${entry.memberName ?? ""}`}
          onClick={() => setOpen(true)}
        >
          <Pencil />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus />
          ثبت دریافتی جدید
        </Button>
      )}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "ویرایش دریافتی" : "ثبت دریافتی جدید"}
          </DialogTitle>
          <DialogDescription>
            مبلغی که باشگاه دریافت کرده را ثبت کنید تا در درآمد ماهانه و
            نمودار درآمد باشگاه دیده شود.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="revenue-member">عضو (اختیاری)</Label>
            <Controller
              control={form.control}
              name="memberId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={members.isLoading}
                >
                  <SelectTrigger id="revenue-member" className="w-full">
                    <SelectValue
                      placeholder={
                        members.isLoading ? "در حال بارگذاری…" : "بدون عضو"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_MEMBER_VALUE}>
                      بدون عضو (مثلاً فروش کالا)
                    </SelectItem>
                    {memberOptions.map((member) => (
                      <SelectItem key={member.userId} value={member.userId}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="revenue-amount">مبلغ (تومان)</Label>
            <Input
              id="revenue-amount"
              dir="ltr"
              inputMode="numeric"
              placeholder="۵۰۰۰۰۰"
              className="text-center"
              {...form.register("amount")}
            />
            {/* Echoes the typed number back grouped, so a missing or extra
                zero is caught before the entry is filed. */}
            {normalizedAmount && /^\d+$/.test(normalizedAmount) && (
              <p className="text-xs text-muted-foreground">
                {formatNumber(Number(normalizedAmount))} تومان
              </p>
            )}
            {form.formState.errors.amount && (
              <p className="text-xs text-destructive">
                {form.formState.errors.amount.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="revenue-category">نوع درآمد</Label>
            <Controller
              control={form.control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="revenue-category" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REVENUE_CATEGORY_VALUES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {REVENUE_CATEGORY_LABEL[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <Controller
            control={form.control}
            name="occurredOn"
            render={({ field }) => (
              <JalaliDateField
                id="revenue-occurred-on"
                label="تاریخ دریافت"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />

          <div className="space-y-2">
            <Label htmlFor="revenue-note">توضیحات (اختیاری)</Label>
            <Input
              id="revenue-note"
              placeholder="مثلاً شهریه مهر ماه"
              {...form.register("note")}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              {isEdit ? "ذخیره تغییرات" : "ثبت دریافتی"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              انصراف
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
