import type { QueryClient } from "@tanstack/react-query";

import { invalidateInvoiceViews } from "@/features/invoices/hooks/invalidate-invoice-views";

/** Sending or answering a questionnaire moves its counters, and a priced one also adds an invoice. */
export function invalidateQuestionnaireViews(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["questionnaires"] });
  invalidateInvoiceViews(queryClient);
}
