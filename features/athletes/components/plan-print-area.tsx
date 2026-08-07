import { formatPersianDate } from "@/lib/persian";
import type { PrintablePlan } from "../hooks/use-plan-print";
import type { PlanKind } from "../types/athlete-types";

const KIND_LABEL: Record<PlanKind, string> = {
  workout: "برنامه تمرینی",
  nutrition: "برنامه غذایی",
};

export function PlanPrintArea({ plan }: { plan: PrintablePlan | null }) {
  if (!plan) return null;

  return (
    <div className="print-area hidden bg-white print:block" dir="rtl">
      <div className="mx-auto max-w-2xl p-8 text-black">
        <div className="mb-6 flex items-center justify-between border-b border-black/20 pb-4">
          <div>
            <p className="text-lg font-bold">جیم‌لیک</p>
            <p className="text-sm text-black/60">{KIND_LABEL[plan.kind]}</p>
          </div>
          <p className="text-sm text-black/60">
            {formatPersianDate(new Date(plan.assignedAt))}
          </p>
        </div>

        <h1 className="mb-3 text-xl font-bold">{plan.title}</h1>

        {(plan.athleteName || plan.trainerName) && (
          <div className="mb-4 space-y-1 text-sm text-black/70">
            {plan.athleteName && <p>ورزشکار: {plan.athleteName}</p>}
            {plan.trainerName && <p>مربی: {plan.trainerName}</p>}
          </div>
        )}

        <div className="whitespace-pre-line text-sm leading-7">
          {plan.description || "توضیحاتی برای این برنامه ثبت نشده است."}
        </div>
      </div>
    </div>
  );
}
