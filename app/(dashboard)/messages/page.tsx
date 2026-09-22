import { Suspense } from "react";

import { RouteLoading } from "@/components/layout/route-loading";
import { MessagesPage } from "@/features/messages";

export const metadata = { title: "پیام‌ها | جیم‌لیک" };

export default function Page() {
  // MessagesPage reads `?with=` via useSearchParams, which has to sit behind a
  // Suspense boundary for the page to be prerendered at build time.
  return (
    <Suspense fallback={<RouteLoading />}>
      <MessagesPage />
    </Suspense>
  );
}
