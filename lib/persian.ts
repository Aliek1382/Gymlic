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

// Short "day month" label (no year) for chart axes — e.g. "۱۶ مرداد".
export function formatShortPersianDate(date: Date): string {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    month: "short",
    day: "numeric",
  }).format(date);
}

// "۲۷ ساله" from a stored birth date, or null when there's no usable date —
// callers just omit the field rather than printing a placeholder age.
export function formatAge(birthDate: string | null | undefined): string | null {
  if (!birthDate) return null;

  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const monthDiff = now.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate())) {
    age -= 1;
  }
  if (age < 0 || age > 120) return null;

  return `${toPersianDigits(age)} ساله`;
}

// Short relative label for timestamps like notifications — "همین الان",
// "۵ دقیقه پیش", "۳ روز پیش" — falling back to the full date past a week.
export function formatRelativeTime(date: Date): string {
  const diffSeconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (diffSeconds < 60) return "همین الان";

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${toPersianDigits(diffMinutes)} دقیقه پیش`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${toPersianDigits(diffHours)} ساعت پیش`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${toPersianDigits(diffDays)} روز پیش`;

  return formatPersianDate(date);
}

// ----------------------------------------------------------------------------
// Jalali (Persian) calendar conversion
//
// Rather than hand-rolling Jalali leap-year math (easy to get subtly wrong),
// these lean entirely on the platform's own Intl "persian" calendar — which
// is what formatPersianDate above already uses to display dates — so the
// picker can never disagree with how dates are shown elsewhere in the app.
// jalaliToGregorian inverts that by searching around an estimate until
// Intl's formatting of the guess matches the target y/m/d.
// ----------------------------------------------------------------------------

export interface JalaliDate {
  jy: number;
  jm: number;
  jd: number;
}

// "-nu-latn" forces ASCII digits in formatToParts output — without it the
// values come back as Persian digits ("۱۴۰۳"), which Number() can't parse.
const jalaliPartsFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

export function getJalaliParts(date: Date): JalaliDate {
  const parts = jalaliPartsFormatter.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { jy: get("year"), jm: get("month"), jd: get("day") };
}

export function getCurrentJalaliYear(): number {
  return getJalaliParts(new Date()).jy;
}

function addDaysUTC(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

// Converts a Jalali y/m/d to a Gregorian Date (UTC midnight). Throws if the
// combination doesn't converge to a real date within a generous iteration
// budget (only possible for a day/month combination that doesn't exist,
// e.g. 30 Esfand in a non-leap year).
export function jalaliToGregorian(jy: number, jm: number, jd: number): Date {
  let guess = new Date(Date.UTC(jy + 621, jm - 1, jd));

  for (let i = 0; i < 400; i++) {
    const parts = getJalaliParts(guess);
    if (parts.jy === jy && parts.jm === jm && parts.jd === jd) {
      return guess;
    }
    if (parts.jy !== jy) {
      guess = addDaysUTC(guess, (jy - parts.jy) * 365);
    } else if (parts.jm !== jm) {
      guess = addDaysUTC(guess, (jm - parts.jm) * 30);
    } else {
      guess = addDaysUTC(guess, jd - parts.jd);
    }
  }
  throw new Error("تاریخ وارد شده معتبر نیست.");
}

// Number of days in a given Jalali month (29–31), leap years included —
// derived from the same conversion rather than a separate leap-year rule.
export function jalaliMonthLength(jy: number, jm: number): number {
  const start = jalaliToGregorian(jy, jm, 1);
  const nextJy = jm === 12 ? jy + 1 : jy;
  const nextJm = jm === 12 ? 1 : jm + 1;
  const nextStart = jalaliToGregorian(nextJy, nextJm, 1);
  return Math.round((nextStart.getTime() - start.getTime()) / 86_400_000);
}
