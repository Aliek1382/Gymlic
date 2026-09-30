"use client";

import { BellRing } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/get-error-message";
import {
  useAssessmentReminder,
  useSaveAssessmentReminder,
} from "../hooks/use-assessment-reminder";

const INTERVAL_OPTIONS = [2, 4, 6, 8];

export function AssessmentReminderCard({ athleteId }: { athleteId: string }) {
  const reminder = useAssessmentReminder(athleteId);
  const save = useSaveAssessmentReminder(athleteId);

  if (!reminder.data) return null;
  const { intervalWeeks, isActive } = reminder.data;

  async function update(next: { intervalWeeks: number; isActive: boolean }) {
    try {
      await save.mutateAsync(next);
      toast.success("تنظیمات یادآوری ذخیره شد.");
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیره تنظیمات یادآوری با خطا مواجه شد."));
    }
  }

  return (
    <Card className="gap-4 px-6 py-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BellRing className="size-4 text-muted-foreground" />
          <Label htmlFor="assessment-reminder-switch" className="text-sm font-medium">
            یادآوری دوره‌ای اندازه‌گیری
          </Label>
        </div>
        <Switch
          id="assessment-reminder-switch"
          checked={isActive}
          disabled={save.isPending}
          onCheckedChange={(checked) => update({ intervalWeeks, isActive: checked })}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          اگر آخرین اندازه‌گیری از این بازه قدیمی‌تر شود، به ورزشکار اعلان یادآوری می‌رسد.
        </p>
        <Select
          value={String(intervalWeeks)}
          disabled={save.isPending || !isActive}
          onValueChange={(value) => update({ intervalWeeks: Number(value), isActive })}
        >
          <SelectTrigger className="w-40 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INTERVAL_OPTIONS.map((weeks) => (
              <SelectItem key={weeks} value={String(weeks)}>
                هر {weeks} هفته
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Card>
  );
}
