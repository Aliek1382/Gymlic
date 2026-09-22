import { Suspense } from "react";

import { RouteLoading } from "@/components/layout/route-loading";
import { AdminClubDetailPage } from "@/features/admin/components/admin-club-detail-page";

export const metadata = { title: "جزئیات باشگاه | پنل مدیریت جیم‌لیک" };

export default function Page() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <AdminClubDetailPage />
    </Suspense>
  );
}
