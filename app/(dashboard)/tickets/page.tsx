import { Suspense } from "react";

import { RouteLoading } from "@/components/layout/route-loading";
import { TicketsPage } from "@/features/tickets";

export const metadata = { title: "تیکت‌ها | جیم‌لیک" };

export default function Page() {
  // TicketsPage reads `?id=` via useSearchParams, which has to sit behind a
  // Suspense boundary for the page to be prerendered at build time.
  return (
    <Suspense fallback={<RouteLoading />}>
      <TicketsPage />
    </Suspense>
  );
}
