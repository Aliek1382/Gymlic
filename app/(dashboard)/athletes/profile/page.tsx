import { Suspense } from "react";

import { RouteLoading } from "@/components/layout/route-loading";
import { AthleteProfilePage } from "@/features/athletes";

export const metadata = { title: "پروفایل ورزشکار | جیم‌لیک" };

export default function Page() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <AthleteProfilePage />
    </Suspense>
  );
}
