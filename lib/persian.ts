const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export const PERSIAN_MONTH_NAMES = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

export function toPersianDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}

export function formatNumber(value: number): string {
  return toPersianDigits(new Intl.NumberFormat("en-US").format(Math.round(value)));
}

export function formatCompactNumber(value: number): string {
  if (value >= 1000) {
    const thousands = value / 1000;
    const rounded = Number.isInteger(thousands)
      ? thousands.toString()
      : thousands.toFixed(1);
    return `${toPersianDigits(rounded)} هزار`;
  }
  return formatNumber(value);
}

export function formatToman(amount: number): string {
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    const rounded = Number.isInteger(millions)
      ? millions.toString()
      : millions.toFixed(1);
    return `${toPersianDigits(rounded)} میلیون`;
  }
  if (amount >= 1_000) {
    return `${toPersianDigits((amount / 1000).toFixed(0))} هزار`;
  }
  return formatNumber(amount);
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${toPersianDigits(Math.abs(value).toFixed(1).replace(/\.0$/, ""))}٪`;
}

export function getPersianMonthLabel(date: Date): string {
  // Approximate Jalali month index without a full calendar library: derive
  // from the Gregorian month is not accurate for production, but the app
  // uses Intl's Persian calendar for correct conversion at render time.
  const formatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    month: "long",
  });
  return formatter.format(date);
}

export function formatPersianDate(date: Date): string {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}
