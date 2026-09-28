"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createInvoice } from "../services/invoice-service";
import { invalidateInvoiceViews } from "./invalidate-invoice-views";

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createInvoice,
    onSuccess: () => invalidateInvoiceViews(queryClient),
  });
}
