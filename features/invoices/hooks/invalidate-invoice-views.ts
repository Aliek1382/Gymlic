import type { QueryClient } from "@tanstack/react-query";

/** An invoice changing flips a plan between locked and open, so every view of plans refetches too. */
export function invalidateInvoiceViews(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["invoices"] });
  queryClient.invalidateQueries({ queryKey: ["athletes", "plans"] });
  queryClient.invalidateQueries({ queryKey: ["athletes", "my-plans"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard"] });
}
