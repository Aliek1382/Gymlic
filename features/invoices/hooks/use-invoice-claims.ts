"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  approveInvoiceClaim,
  cancelInvoiceClaim,
  rejectInvoiceClaim,
  submitInvoiceClaim,
} from "../services/invoice-service";
import { invalidateInvoiceViews } from "./invalidate-invoice-views";

/** Athlete: "I paid". The invoice stays pending, so only the invoice lists change. */
export function useSubmitInvoiceClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitInvoiceClaim,
    onSuccess: () => invalidateInvoiceViews(queryClient),
  });
}

/** Athlete: takes the claim back while the trainer has not answered it. */
export function useCancelInvoiceClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelInvoiceClaim,
    onSuccess: () => invalidateInvoiceViews(queryClient),
  });
}

/** Trainer: approving settles the invoice, so every view of the plan changes. */
export function useApproveInvoiceClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: approveInvoiceClaim,
    onSuccess: () => invalidateInvoiceViews(queryClient),
  });
}

export function useRejectInvoiceClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { invoiceId: string; note?: string }) =>
      rejectInvoiceClaim(input.invoiceId, input.note),
    onSuccess: () => invalidateInvoiceViews(queryClient),
  });
}
