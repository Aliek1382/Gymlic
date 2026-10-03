"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * Lets whoever filed a payment take it back while nobody has answered it: the
 * request and its receipt are deleted, and they can file a corrected one.
 */
export function CancelRequestButton({
  onCancel,
  queryKeys,
}: {
  onCancel: () => Promise<unknown>;
  /** Lists to refresh afterwards. */
  queryKeys: readonly (readonly unknown[])[];
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        لغو درخواست
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="لغو درخواست پرداخت"
        description="درخواست و رسید پیوست‌شده حذف می‌شود و می‌توانید دوباره و درست‌تر ثبت کنید. اگر واریز انجام شده، پول برنمی‌گردد."
        confirmLabel="لغو درخواست"
        errorMessage="لغو درخواست ناموفق بود."
        onConfirm={async () => {
          await onCancel();
          toast.success("درخواست لغو شد.");
          await Promise.all(queryKeys.map((key) => queryClient.invalidateQueries({ queryKey: key })));
        }}
      />
    </>
  );
}
