import { WEEKDAYS } from "@/features/athletes/utils/workout-plan-text";
import { getJalaliParts, toPersianDigits } from "@/lib/persian";
import { parseIsoDate } from "@/lib/iso-date";

/**
 * The repeat rule the API stores in calendar_events.recurrence_rule:
 *   d[/N]  w[/N][:weekdays]  m[/N][:jalali days of month]  y[/N]
 * (weekday numbers 0 = Sunday .. 6). This module turns it to and from the
 * form's state, and into a Persian sentence. The API is the one that expands it.
 */
export type RepeatPreset = "none" | "daily" | "weekly" | "monthly" | "yearly" | "custom";
export type RepeatUnit = "day" | "week" | "month" | "year";

export interface RepeatState {
  preset: RepeatPreset;
  /** Custom only: every `interval` units. */
  interval: number;
  unit: RepeatUnit;
  /** Custom week: PHP weekday numbers. */
  weekdays: number[];
  /** Custom month: Jalali days of month, 1..31. */
  monthDays: number[];
}

export const REPEAT_PRESET_LABEL: Record<RepeatPreset, string> = {
  none: "بدون تکرار",
  daily: "هر روز",
  weekly: "هر هفته (همین روز هفته)",
  monthly: "هر ماه (همین روز ماه شمسی)",
  yearly: "هر سال (همین روز و ماه)",
  custom: "دلخواه…",
};

export const REPEAT_UNIT_LABEL: Record<RepeatUnit, string> = {
  day: "روز",
  week: "هفته",
  month: "ماه",
  year: "سال",
};

const UNIT_LETTER: Record<RepeatUnit, string> = { day: "d", week: "w", month: "m", year: "y" };
const LETTER_UNIT: Record<string, RepeatUnit> = { d: "day", w: "week", m: "month", y: "year" };

/** The week starts on Saturday, so the chips follow WEEKDAYS; PHP numbers Sunday as 0. */
export const WEEKDAY_CHIPS = WEEKDAYS.map((label, index) => ({ label, value: (index + 6) % 7 }));

export function emptyRepeat(): RepeatState {
  return { preset: "none", interval: 1, unit: "week", weekdays: [], monthDays: [] };
}

function weekdayOf(dateIso: string): number {
  return parseIsoDate(dateIso).getDay();
}

function jalaliDayOf(dateIso: string): number {
  return getJalaliParts(parseIsoDate(dateIso)).jd;
}

function numbers(list: string | undefined): number[] {
  return list ? list.split(",").map(Number).sort((a, b) => a - b) : [];
}

/** Reads a stored rule (including the old "1,3,5" weekday form) into form state. */
export function parseRule(rule: string | null, dateIso: string): RepeatState {
  const state = emptyRepeat();
  if (!rule) return state;

  const normalized = /^[0-6](,[0-6])*$/.test(rule) ? `w:${rule}` : rule;
  const match = /^([dwmy])(?:\/(\d+))?(?::([\d,]+))?$/.exec(normalized);
  if (!match) return state;

  const unit = LETTER_UNIT[match[1]];
  const interval = match[2] ? Number(match[2]) : 1;
  const list = numbers(match[3]);

  if (interval === 1) {
    // A plain rule ("every week on this day") is one of the ready-made presets.
    if (unit === "day") return { ...state, preset: "daily" };
    if (unit === "year") return { ...state, preset: "yearly" };
    if (unit === "week" && (list.length === 0 || (list.length === 1 && list[0] === weekdayOf(dateIso)))) {
      return { ...state, preset: "weekly" };
    }
    if (unit === "month" && (list.length === 0 || (list.length === 1 && list[0] === jalaliDayOf(dateIso)))) {
      return { ...state, preset: "monthly" };
    }
  }

  return {
    preset: "custom",
    interval,
    unit,
    weekdays: unit === "week" ? (list.length ? list : [weekdayOf(dateIso)]) : [],
    monthDays: unit === "month" ? (list.length ? list : [jalaliDayOf(dateIso)]) : [],
  };
}

/** The rule to send, or null for no repeat. Assumes validateRepeat passed. */
export function buildRule(state: RepeatState): string | null {
  switch (state.preset) {
    case "none":
      return null;
    case "daily":
      return "d";
    case "weekly":
      return "w";
    case "monthly":
      return "m";
    case "yearly":
      return "y";
    case "custom": {
      const every = state.interval > 1 ? `/${state.interval}` : "";
      const list =
        state.unit === "week"
          ? `:${[...state.weekdays].sort((a, b) => a - b).join(",")}`
          : state.unit === "month"
            ? `:${[...state.monthDays].sort((a, b) => a - b).join(",")}`
            : "";
      return `${UNIT_LETTER[state.unit]}${every}${list}`;
    }
  }
}

/** A Persian error for an incomplete custom repeat, or null when the rule can be saved. */
export function validateRepeat(state: RepeatState): string | null {
  if (state.preset !== "custom") return null;
  if (!Number.isInteger(state.interval) || state.interval < 1 || state.interval > 99) {
    return "فاصلهٔ تکرار باید عددی بین ۱ تا ۹۹ باشد.";
  }
  if (state.unit === "week" && state.weekdays.length === 0) return "حداقل یک روز هفته را انتخاب کنید.";
  if (state.unit === "month" && state.monthDays.length === 0) return "حداقل یک روز ماه را انتخاب کنید.";
  return null;
}

/** "هر ۲ هفته، شنبه و دوشنبه" — what the rule means, for the form. */
export function describeRepeat(state: RepeatState, dateIso: string): string {
  const join = (items: string[]) =>
    items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join("، ")} و ${items[items.length - 1]}`;
  const weekdayName = (value: number) => WEEKDAY_CHIPS.find((chip) => chip.value === value)?.label ?? "";

  switch (state.preset) {
    case "none":
      return "";
    case "daily":
      return "هر روز";
    case "weekly":
      return `هر ${weekdayName(weekdayOf(dateIso))}`;
    case "monthly":
      return `هر ماه، روز ${toPersianDigits(jalaliDayOf(dateIso))}`;
    case "yearly":
      return "هر سال، در همین روز و ماه";
    case "custom": {
      const every =
        state.interval === 1 ? `هر ${REPEAT_UNIT_LABEL[state.unit]}` : `هر ${toPersianDigits(state.interval)} ${REPEAT_UNIT_LABEL[state.unit]}`;
      if (state.unit === "week" && state.weekdays.length) {
        const ordered = WEEKDAY_CHIPS.filter((chip) => state.weekdays.includes(chip.value)).map((chip) => chip.label);
        return `${every}، ${join(ordered)}`;
      }
      if (state.unit === "month" && state.monthDays.length) {
        const days = [...state.monthDays].sort((a, b) => a - b).map((day) => toPersianDigits(day));
        return `${every}، روز ${join(days)}`;
      }
      return every;
    }
  }
}
