import Link from "next/link";
import { DatabaseZap } from "lucide-react";

/** Shown on a page whose database update hasn't been run yet. */
export function MigrationNotice({ title }: { title: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-muted px-4 py-3 text-sm text-warning">
      <DatabaseZap className="mt-0.5 size-5 shrink-0" />
      <p className="leading-6">
        این بخش هنوز فعال نیست. به‌روزرسانی «{title}» را از صفحهٔ{" "}
        <Link href="/admin/database" className="font-medium underline underline-offset-4">
          به‌روزرسانی دیتابیس
        </Link>{" "}
        اجرا کنید.
      </p>
    </div>
  );
}
