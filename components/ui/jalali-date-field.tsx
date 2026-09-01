"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PERSIAN_MONTH_NAMES,
  getCurrentJalaliYear,
  getJalaliParts,
  jalaliMonthLength,
  jalaliToGregorian,
  toPersianDigits,
} from "@/lib/persian";
import { parseIsoDate } from "@/lib/iso-date";

// A payment or a revenue entry is recorded when it happens, or shortly
// after — the settings BirthDatePicker's 90-year list would be the wrong
// tool here, so this offers the current Jalali year and the two before it.
const SELECTABLE_YEARS = 3;

export function JalaliDateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  // Parsed as a local calendar day so Intl reads back the same Jalali date
  // the trainer picked, whatever their timezone.
  const { jy, jm, jd } = getJalaliParts(parseIsoDate(value));

  const currentYear = getCurrentJalaliYear();
  const recentYears = Array.from(
    { length: SELECTABLE_YEARS },
    (_, i) => currentYear - i
  );
  // A stored date outside that window still has to appear in the list, or
  // editing an older payment would silently move it to a year in range.
  const years = (
    recentYears.includes(jy) ? recentYears : [...recentYears, jy]
  ).sort((a, b) => b - a);

  function emit(year: number, month: number, day: number) {
    // Moving from a 31-day month to a shorter one (or to Esfand in a
    // non-leap year) would otherwise ask for a day that doesn't exist.
    const clampedDay = Math.min(day, jalaliMonthLength(year, month));
    // jalaliToGregorian returns UTC midnight, so slicing its ISO string
    // gives back exactly the picked calendar day.
    onChange(jalaliToGregorian(year, month, clampedDay).toISOString().slice(0, 10));
  }

  const dayCount = jalaliMonthLength(jy, jm);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="grid grid-cols-3 gap-2">
        <Select
          value={String(jd)}
          onValueChange={(next) => emit(jy, jm, Number(next))}
        >
          <SelectTrigger id={id} aria-label="روز" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: dayCount }, (_, i) => i + 1).map((day) => (
              <SelectItem key={day} value={String(day)}>
                {toPersianDigits(day)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(jm)}
          onValueChange={(next) => emit(jy, Number(next), jd)}
        >
          <SelectTrigger aria-label="ماه" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERSIAN_MONTH_NAMES.map((name, index) => (
              <SelectItem key={name} value={String(index + 1)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(jy)}
          onValueChange={(next) => emit(Number(next), jm, jd)}
        >
          <SelectTrigger aria-label="سال" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {toPersianDigits(year)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
