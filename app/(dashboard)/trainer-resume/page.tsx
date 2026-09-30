import { Suspense } from "react";

import { RouteLoading } from "@/components/layout/route-loading";
import { TrainerResumePage } from "@/features/trainer-resume";

export const metadata = { title: "رزومهٔ مربی | جیم‌لیک" };

export default function Page() {
  // The athlete view reads `?id=` via useSearchParams, which has to sit
  // behind a Suspense boundary for the page to be prerendered at build time.
  return (
    <Suspense fallback={<RouteLoading />}>
      <TrainerResumePage />
    </Suspense>
  );
}
