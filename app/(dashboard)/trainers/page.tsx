import { Suspense } from "react";

import { RouteLoading } from "@/components/layout/route-loading";
import { TrainersPage } from "@/features/trainers";

export const metadata = { title: "مربیان | جیم‌لیک" };

export default function Page() {
  // TrainersPage reads `?new=1` via useSearchParams, which has to sit behind a
  // Suspense boundary for the page to be prerendered at build time.
  return (
    <Suspense fallback={<RouteLoading />}>
      <TrainersPage />
    </Suspense>
  );
}
