import { Suspense } from "react";

import { RouteLoading } from "@/components/layout/route-loading";
import { AdminCoachTicketsPage } from "@/features/admin/components/admin-coach-tickets-page";

export const metadata = { title: "تیکت‌های مربی و ورزشکار | پنل مدیریت جیم‌لیک" };

export default function Page() {
  // One ticket is ?id=, read with useSearchParams behind this boundary.
  return (
    <Suspense fallback={<RouteLoading />}>
      <AdminCoachTicketsPage />
    </Suspense>
  );
}
