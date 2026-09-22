import { TemplateManager } from "@/features/athletes";
import { RoleGate } from "@/features/authentication/components/role-gate";

export const metadata = { title: "قالب‌ها | جیم‌لیک" };

export default function TemplatesPage() {
  return (
    <RoleGate allow={["trainer"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">قالب‌ها</h1>
          <p className="text-sm text-muted-foreground">
            قالب‌های آماده برای برنامه تمرینی و غذایی بسازید تا هنگام نوشتن
            برنامه برای ورزشکاران سریع‌تر شروع کنید.
          </p>
        </div>

        <TemplateManager />
      </div>
    </RoleGate>
  );
}
