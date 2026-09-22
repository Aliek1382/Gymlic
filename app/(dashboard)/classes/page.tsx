import { Calendar } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";
import { RoleGate } from "@/features/authentication/components/role-gate";

export const metadata = { title: "کلاس‌ها | جیم‌لیک" };

export default function ClassesPage() {
  return (
    <RoleGate allow={["club"]}>
      <ComingSoon
        icon={Calendar}
        title="مدیریت کلاس‌ها"
        description="زمان‌بندی کلاس‌ها و پیگیری حضور و غیاب اعضا به‌زودی در دسترس خواهد بود."
      />
    </RoleGate>
  );
}
