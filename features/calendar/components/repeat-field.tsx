"use client";

import { Input } from "@/components/ui/input";
import { JalaliDateField } from "@/components/ui/jalali-date-field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseIsoDate } from "@/lib/iso-date";
import { getJalaliParts, toAsciiDigits, toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";
import {
  REPEAT_PRESET_LABEL,
  REPEAT_UNIT_LABEL,
  WEEKDAY_CHIPS,
  describeRepeat,
  type RepeatPreset,
  type RepeatState,
  type RepeatUnit,
} from "../utils/recurrence";

const PRESETS = Object.keys(REPEAT_PRESET_LABEL) as RepeatPreset[];
const UNITS = Object.keys(REPEAT_UNIT_LABEL) as RepeatUnit[];
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

function toggle(list: number[], value: number): number[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function Chip({ selected, onClick, children, label }: { selected: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-xs transition-colors",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}

/** "Repeat" picker: ready-made choices, or a custom every-N weeks/months with chosen days. */
export function RepeatField({
  value,
  onChange,
  date,
  until,
  onUntilChange,
}: {
  value: RepeatState;
  onChange: (next: RepeatState) => void;
  /** The event's own date, "YYYY-MM-DD" — what "same weekday/day of month" means. */
  date: string;
  /** "YYYY-MM-DD" the repeat stops on, or "" to repeat with no end. */
  until: string;
  onUntilChange: (next: string) => void;
}) {
  const summary = describeRepeat(value, date);

  // Choosing custom weeks or months starts from the event's own weekday or day of month, so it is never empty.
  function change(next: RepeatState) {
    if (next.preset === "custom") {
      const day = parseIsoDate(date);
      if (next.unit === "week" && next.weekdays.length === 0) next = { ...next, weekdays: [day.getDay()] };
      if (next.unit === "month" && next.monthDays.length === 0) next = { ...next, monthDays: [getJalaliParts(day).jd] };
    }
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="event-recurrence">تکرار</Label>
        <Select
          value={value.preset}
          onValueChange={(preset) => change({ ...value, preset: preset as RepeatPreset })}
        >
          <SelectTrigger id="event-recurrence" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((preset) => (
              <SelectItem key={preset} value={preset}>
                {REPEAT_PRESET_LABEL[preset]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {value.preset === "custom" && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="grid grid-cols-[auto_5rem_1fr] items-center gap-2">
            <Label htmlFor="repeat-interval" className="text-sm">هر</Label>
            <Input
              id="repeat-interval"
              inputMode="numeric"
              className="text-center"
              value={toPersianDigits(value.interval || "")}
              onChange={(e) => {
                const digits = toAsciiDigits(e.target.value).replace(/\D/g, "").slice(0, 2);
                onChange({ ...value, interval: digits === "" ? 0 : Number(digits) });
              }}
            />
            <Select value={value.unit} onValueChange={(unit) => change({ ...value, unit: unit as RepeatUnit })}>
              <SelectTrigger aria-label="واحد تکرار" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {REPEAT_UNIT_LABEL[unit]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {value.unit === "week" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">در این روزهای هفته:</p>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_CHIPS.map((chip) => (
                  <Chip
                    key={chip.value}
                    label={chip.label}
                    selected={value.weekdays.includes(chip.value)}
                    onClick={() => onChange({ ...value, weekdays: toggle(value.weekdays, chip.value) })}
                  >
                    {chip.label}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {value.unit === "month" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                در این روزهای ماه شمسی (روزی که در ماه نباشد، آخرین روز ماه حساب می‌شود):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {MONTH_DAYS.map((day) => (
                  <Chip
                    key={day}
                    label={`روز ${toPersianDigits(day)}`}
                    selected={value.monthDays.includes(day)}
                    onClick={() => onChange({ ...value, monthDays: toggle(value.monthDays, day) })}
                  >
                    {toPersianDigits(day)}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {value.preset !== "none" && (
        <>
          {summary && <p className="text-xs text-muted-foreground">تکرار: {summary}</p>}

          <div className="space-y-2">
            <Label htmlFor="repeat-end">پایان تکرار</Label>
            <Select value={until ? "until" : "never"} onValueChange={(mode) => onUntilChange(mode === "until" ? date : "")}>
              <SelectTrigger id="repeat-end" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">هرگز</SelectItem>
                <SelectItem value="until">تا یک تاریخ مشخص</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {until && (
            <JalaliDateField
              id="repeat-until"
              label="آخرین روز تکرار"
              value={until}
              onChange={onUntilChange}
              pastYears={1}
              futureYears={5}
            />
          )}
        </>
      )}
    </div>
  );
}
