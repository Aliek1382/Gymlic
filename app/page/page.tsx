import { Suspense } from "react";

import { RouteLoading } from "@/components/layout/route-loading";
import { SitePageView } from "@/features/site-pages";

export const metadata = { title: "جیم‌لیک" };

export default function Page() {
  // A static export has no /page/[slug] route per page: the slug travels in
  // the query string, read with useSearchParams behind this boundary.
  return (
    <Suspense fallback={<RouteLoading />}>
      <SitePageView />
    </Suspense>
  );
}
