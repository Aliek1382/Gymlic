import { toPersianDigits } from "@/lib/persian";

/** "۱٫۲ مگابایت" — for database, upload and backup sizes. */
export function formatBytes(bytes: number): string {
  const units = ["بایت", "کیلوبایت", "مگابایت", "گیگابایت"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const rounded = unit === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${toPersianDigits(String(rounded)).replace(".", "٫")} ${units[unit]}`;
}

/** "۵ دقیقه پیش" from a minute count the server worked out on its own clock. */
export function formatMinutesAgo(minutes: number): string {
  if (minutes < 1) return "همین الان";
  if (minutes < 60) return `${toPersianDigits(minutes)} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${toPersianDigits(hours)} ساعت پیش`;
  return `${toPersianDigits(Math.floor(hours / 24))} روز پیش`;
}

/** SQL "YYYY-MM-DD HH:MM:SS" in a form every browser (Safari too) parses. */
export function parseSqlDate(value: string): Date {
  return new Date(value.replace(" ", "T"));
}
