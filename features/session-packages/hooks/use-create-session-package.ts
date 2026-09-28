"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { invalidateInvoiceViews } from "@/features/invoices/hooks/invalidate-invoice-views";
import { createSessionPackage } from "../services/session-package-service";

export function useCreateSessionPackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSessionPackage,
    // Selling a package also issues an invoice.
    onSuccess: () => invalidateInvoiceViews(queryClient),
  });
}
