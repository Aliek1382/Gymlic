import { Suspense } from "react";

import { RouteLoading } from "@/components/layout/route-loading";
import { AdminSupportPage } from "@/features/admin/components/admin-support-page";

export const metadata = { title: "تیکت‌های پشتیبانی | پنل مدیریت جیم‌لیک" };

export default function Page() {
  // One ticket is ?id=, read with useSearchParams behind this boundary.
  return (
    <Suspense fallback={<RouteLoading />}>
      <AdminSupportPage />
    </Suspense>
  );
}
