"use client";

import { useState } from "react";
import { Calendar, ChevronLeft, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  PERSIAN_MONTH_NAMES,
  formatPersianDate,
  getCurrentJalaliYear,
  jalaliMonthLength,
  jalaliToGregorian,
} from "@/lib/persian";

type Step = "year" | "month" | "day";

const OLDEST_AGE = 90;
const YOUNGEST_AGE = 0;

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function BirthDatePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("year");
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);

  const currentJalaliYear = getCurrentJalaliYear();
  const years = Array.from(
    { length: OLDEST_AGE - YOUNGEST_AGE + 1 },
    (_, i) => currentJalaliYear - YOUNGEST_AGE - i
  );

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Every open starts back at year selection, per how this was asked
      // for — not resumed from wherever the user left off last time.
      setStep("year");
      setYear(null);
      setMonth(null);
    }
  }

  function handleSelectYear(y: number) {
    setYear(y);
    setStep("month");
  }

  function handleSelectMonth(m: number) {
    setMonth(m);
    setStep("day");
  }

  function handleSelectDay(d: number) {
    if (year === null || month === null) return;
    const date = jalaliToGregorian(year, month, d);
    onChange(toIsoDate(date));
    handleOpenChange(false);
  }

  const dayCount =
    year !== null && month !== null ? jalaliMonthLength(year, month) : 0;

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="border-input flex h-11 w-full items-center justify-between gap-2 rounded-xl border bg-transparent px-4 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
        >
          <span className={value ? "text-foreground" : "text-muted-foreground"}>
            {value
              ? formatPersianDate(new Date(value))
              : "انتخاب تاریخ تولد"}
          </span>
          <Calendar className="size-4 shrink-0 text-muted-foreground" />
        </button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            aria-label="پاک کردن تاریخ تولد"
            onClick={() => onChange(null)}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
              {step !== "year" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  aria-label="بازگشت"
                  onClick={() => setStep(step === "day" ? "month" : "year")}
                >
                  <ChevronLeft className="size-4" />
                </Button>
              )}
              <DialogTitle>
                {step === "year" && "سال تولد را انتخاب کنید"}
                {step === "month" && `${year} — ماه تولد را انتخاب کنید`}
                {step === "day" &&
                  `${year} ${PERSIAN_MONTH_NAMES[(month ?? 1) - 1]} — روز تولد را انتخاب کنید`}
              </DialogTitle>
            </div>
          </DialogHeader>

          {step === "year" && (
            <ScrollArea className="h-72">
              <div className="grid grid-cols-4 gap-2 pl-3">
                {years.map((y) => (
                  <Button
                    key={y}
                    type="button"
                    size="sm"
                    variant={y === year ? "default" : "outline"}
                    onClick={() => handleSelectYear(y)}
                  >
                    {y}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          )}

          {step === "month" && (
            <div className="grid grid-cols-3 gap-2">
              {PERSIAN_MONTH_NAMES.map((name, index) => (
                <Button
                  key={name}
                  type="button"
                  size="sm"
                  variant={index + 1 === month ? "default" : "outline"}
                  onClick={() => handleSelectMonth(index + 1)}
                >
                  {name}
                </Button>
              ))}
            </div>
          )}

          {step === "day" && (
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
                <Button
                  key={d}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="px-0"
                  onClick={() => handleSelectDay(d)}
                >
                  {d}
                </Button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
