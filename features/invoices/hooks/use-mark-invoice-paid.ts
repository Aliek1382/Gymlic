"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { markInvoicePaid } from "../services/invoice-service";
import { invalidateInvoiceViews } from "./invalidate-invoice-views";

export function useMarkInvoicePaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markInvoicePaid,
    onSuccess: () => invalidateInvoiceViews(queryClient),
  });
}
