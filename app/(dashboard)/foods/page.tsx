import { Suspense } from "react";

import { RouteLoading } from "@/components/layout/route-loading";
import { NutritionLibraryPage } from "@/features/foods";
import { RoleGate } from "@/features/authentication/components/role-gate";

export const metadata = { title: "کتابخانه غذاها و مکمل‌ها | جیم‌لیک" };

export default function FoodsPage() {
  return (
    <RoleGate allow={["trainer"]}>
      {/* The tab is read from `?tab=` with useSearchParams, which needs a Suspense boundary to prerender. */}
      <Suspense fallback={<RouteLoading />}>
        <NutritionLibraryPage />
      </Suspense>
    </RoleGate>
  );
}
