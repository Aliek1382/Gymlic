import { Suspense } from "react";

import { RouteLoading } from "@/components/layout/route-loading";
import { AdminTrainerDetailPage } from "@/features/admin/components/admin-trainer-detail-page";

export const metadata = { title: "جزئیات مربی | پنل مدیریت جیم‌لیک" };

export default function Page() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <AdminTrainerDetailPage />
    </Suspense>
  );
}
