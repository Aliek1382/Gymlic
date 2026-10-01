"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileImage, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteReceipt } from "@/features/admin/services/admin-billing-service";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatPersianDate } from "@/lib/persian";
import { fetchReceiptBlob, type ReceiptKind } from "../services/finance-service";

interface ReceiptViewerProps {
  /** The payment request, or the invoice claim when kind is "invoice-claim". */
  requestId: string;
  kind?: ReceiptKind;
  isPdf?: boolean;
  /** Admins can delete the file before its time. */
  canDelete?: boolean;
  /** When the file will be deleted automatically, if known. */
  expiresAt?: string | null;
}

/** The receipt image or PDF of a payment request, opened in a dialog. */
export function ReceiptViewer({
  requestId,
  kind = "payment-request",
  isPdf = false,
  canDelete = false,
  expiresAt,
}: ReceiptViewerProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: blob, isLoading, isError, error } = useQuery({
    queryKey: ["payment-receipt", kind, requestId],
    queryFn: () => fetchReceiptBlob(requestId, kind),
    enabled: open,
    // A receipt never changes, and is deleted rather than edited.
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });

  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return;
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [blob]);

  async function remove() {
    await deleteReceipt(
      requestId,
      kind === "trainer-payment" || kind === "membership-payment" ? kind : "payment-request"
    );
    toast.success("رسید حذف شد.");
    setOpen(false);
    void queryClient.invalidateQueries({ queryKey: ["admin"] });
    void queryClient.invalidateQueries({ queryKey: ["finance"] });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <FileImage />
        مشاهده رسید
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>رسید پرداخت</DialogTitle>
            <DialogDescription>
              {expiresAt
                ? `این فایل در تاریخ ${formatPersianDate(new Date(expiresAt))} به‌طور خودکار حذف می‌شود.`
                : "فایل رسید پس از بررسی درخواست، پس از چند روز به‌طور خودکار حذف می‌شود."}
            </DialogDescription>
          </DialogHeader>

          {isLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          )}
          {isError && (
            <p className="py-6 text-center text-sm text-destructive">
              {getErrorMessage(error, "دریافت رسید ناموفق بود.")}
            </p>
          )}
          {url && !isPdf && (
            // eslint-disable-next-line @next/next/no-img-element -- a blob: URL, nothing for next/image to optimize
            <img src={url} alt="تصویر رسید پرداخت" className="mx-auto max-h-[70dvh] rounded-lg border border-border" />
          )}
          {url && isPdf && (
            <iframe src={url} title="رسید پرداخت" className="h-[70dvh] w-full rounded-lg border border-border" />
          )}

          {url && (
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <a href={url} download={isPdf ? "receipt.pdf" : "receipt.jpg"}>
                  <Download />
                  دانلود
                </a>
              </Button>
              {canDelete && (
                <Button size="sm" variant="destructive" onClick={() => setConfirmOpen(true)}>
                  <Trash2 />
                  حذف رسید
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="حذف رسید"
        description="فایل رسید برای همیشه پاک می‌شود. کد پیگیری و چهار رقم کارت می‌ماند."
        confirmLabel="حذف رسید"
        errorMessage="حذف رسید ناموفق بود."
        onConfirm={remove}
      />
    </>
  );
}
