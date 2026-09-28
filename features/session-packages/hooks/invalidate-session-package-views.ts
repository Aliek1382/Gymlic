import type { QueryClient } from "@tanstack/react-query";

/** Sessions closing moves a package's counter and can complete it, so lists and sessions refetch together. */
export function invalidateSessionPackageViews(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["session-packages"] });
}
