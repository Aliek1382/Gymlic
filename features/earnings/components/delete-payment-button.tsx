"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
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
import { formatNumber, formatPersianDate } from "@/lib/persian";
import { getErrorMessage } from "@/lib/get-error-message";
import { useDeleteTrainerPayment } from "../hooks/use-delete-trainer-payment";
import { parseIsoDate } from "@/lib/iso-date";
import type { TrainerPayment } from "../types/earnings-types";

export function DeletePaymentButton({ payment }: { payment: TrainerPayment }) {
  const [open, setOpen] = useState(false);
  const deletePayment = useDeleteTrainerPayment();

  async function handleConfirm() {
    try {
      await deletePayment.mutateAsync(payment.id);
      toast.success("پرداخت حذف شد.");
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "حذف پرداخت با خطا مواجه شد."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
        aria-label="حذف پرداخت"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>حذف پرداخت</DialogTitle>
          <DialogDescription>
            پرداخت {formatNumber(payment.amountToman)} تومانی {payment.athleteName}{" "}
            در تاریخ {formatPersianDate(parseIsoDate(payment.paidAt))} حذف شود؟
            این مبلغ از درآمد شما کم می‌شود.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={deletePayment.isPending}
          >
            {deletePayment.isPending && <Loader2 className="animate-spin" />}
            بله، حذف کن
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            انصراف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
