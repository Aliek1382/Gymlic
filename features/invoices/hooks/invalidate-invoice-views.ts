import type { QueryClient } from "@tanstack/react-query";

/**
 * An invoice changing flips a plan or questionnaire between locked and open,
 * and a session package between pending and active, so every view of those
 * refetches too.
 */
export function invalidateInvoiceViews(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["invoices"] });
  queryClient.invalidateQueries({ queryKey: ["athletes", "plans"] });
  queryClient.invalidateQueries({ queryKey: ["athletes", "my-plans"] });
  queryClient.invalidateQueries({ queryKey: ["session-packages"] });
  queryClient.invalidateQueries({ queryKey: ["questionnaires"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard"] });
}
