import { Suspense } from "react";

import { RouteLoading } from "@/components/layout/route-loading";
import { MemberProfileRoute } from "@/features/members";

export const metadata = { title: "پروفایل عضو | جیم‌لیک" };

export default function Page() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <MemberProfileRoute />
    </Suspense>
  );
}
