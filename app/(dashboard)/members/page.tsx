import { Suspense } from "react";

import { RouteLoading } from "@/components/layout/route-loading";
import { MembersPage } from "@/features/members";

export const metadata = { title: "اعضا | جیم‌لیک" };

export default function Page() {
  // MembersPage reads `?new=1` via useSearchParams, which has to sit behind a
  // Suspense boundary for the page to be prerendered at build time.
  return (
    <Suspense fallback={<RouteLoading />}>
      <MembersPage />
    </Suspense>
  );
}
