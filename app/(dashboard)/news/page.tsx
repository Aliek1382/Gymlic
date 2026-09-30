import { NewsList } from "@/features/news";
import { RoleGate } from "@/features/authentication/components/role-gate";

export const metadata = { title: "اخبار | جیم‌لیک" };

export default function NewsPage() {
  return (
    <RoleGate allow={["trainer", "athlete"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">اخبار</h1>
          <p className="text-sm text-muted-foreground">
            اطلاعیه‌های جیم‌لیک و تازه‌ترین مقالات وب‌سایت.
          </p>
        </div>

        <NewsList />
      </div>
    </RoleGate>
  );
}
