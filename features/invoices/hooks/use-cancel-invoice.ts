"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cancelInvoice } from "../services/invoice-service";
import { invalidateInvoiceViews } from "./invalidate-invoice-views";

export function useCancelInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelInvoice,
    onSuccess: () => invalidateInvoiceViews(queryClient),
  });
}
