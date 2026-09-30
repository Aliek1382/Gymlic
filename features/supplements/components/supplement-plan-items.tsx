import type { SupplementPlan } from "../types/supplement-types";
import { describeTiming } from "./supplement-timing-label";

/** The lines of a plan, the same for the trainer and the athlete. */
export function SupplementPlanItems({ plan }: { plan: SupplementPlan }) {
  return (
    <ul className="space-y-2">
      {plan.items.map((item) => (
        <li key={item.id} className="rounded-xl border border-border p-3">
          <p className="text-sm font-medium text-foreground">
            {item.supplementName} — {item.dose}
          </p>
          <p className="text-xs text-muted-foreground">{describeTiming(item)}</p>
          {item.note && <p className="mt-0.5 text-xs text-muted-foreground">{item.note}</p>}
        </li>
      ))}
    </ul>
  );
}
