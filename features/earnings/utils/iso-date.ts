/**
 * `trainer_payments.paid_at` is a `date` column, so it travels as a bare
 * "YYYY-MM-DD" with no time or zone attached. These helpers keep it that
 * way in the viewer's own calendar: going through Date#toISOString() would
 * shift the day for anyone east or west of UTC and land a payment in the
 * wrong month.
 */

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function todayIso(): string {
  return toIsoDate(new Date());
}
