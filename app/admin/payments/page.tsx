import { Suspense } from "react";

import { RouteLoading } from "@/components/layout/route-loading";
import { AdminPaymentsPage } from "@/features/admin/components/admin-payments-page";

export const metadata = { title: "درخواست‌های پرداخت | پنل مدیریت جیم‌لیک" };

export default function Page() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <AdminPaymentsPage />
    </Suspense>
  );
}
