import { Suspense } from "react";

import { RouteLoading } from "@/components/layout/route-loading";
import { RoleGate } from "@/features/authentication/components/role-gate";
import { NewsDetail } from "@/features/news";

export const metadata = { title: "خبر | جیم‌لیک" };

export default function Page() {
  return (
    <RoleGate allow={["trainer", "athlete"]}>
      <Suspense fallback={<RouteLoading />}>
        <NewsDetail />
      </Suspense>
    </RoleGate>
  );
}
