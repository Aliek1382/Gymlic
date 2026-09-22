import { Suspense } from "react";

import { RouteLoading } from "@/components/layout/route-loading";
import { InvitationPage } from "@/features/authentication";

export const metadata = { title: "تایید دعوت | جیم‌لیک" };

export default function Page() {
  // InvitationPage reads `?code=` via useSearchParams, which has to sit behind
  // a Suspense boundary for the page to be prerendered at build time.
  return (
    <Suspense fallback={<RouteLoading />}>
      <InvitationPage />
    </Suspense>
  );
}
