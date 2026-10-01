import { Suspense } from "react";

import { RouteLoading } from "@/components/layout/route-loading";
import { SupportPage } from "@/features/support";

export const metadata = { title: "پشتیبانی | جیم‌لیک" };

export default function Page() {
  // SupportPage reads `?id=` via useSearchParams, which needs a Suspense boundary to prerender.
  return (
    <Suspense fallback={<RouteLoading />}>
      <SupportPage />
    </Suspense>
  );
}
