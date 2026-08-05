// Workout plan descriptions stay free text (a trainer can always type
// directly), but the day-of-week builder groups picked exercises under a
// "روز:" heading line within that same text instead of a separate
// structured field.
export const WEEKDAYS = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

function dayHeading(day: string): string {
  return `${day}:`;
}

function isDayHeadingLine(line: string): boolean {
  return WEEKDAYS.some((day) => line.trim() === dayHeading(day));
}

// Inserts `line` at the end of `day`'s block if that heading already exists
// in `currentText`, otherwise appends a new "روز:" section at the end.
export function insertExerciseLineForDay(
  currentText: string,
  day: string,
  line: string
): string {
  const heading = dayHeading(day);

  if (!currentText.trim()) {
    return `${heading}\n${line}`;
  }

  const lines = currentText.split("\n");
  const headingIndex = lines.findIndex((l) => l.trim() === heading);

  if (headingIndex === -1) {
    const prefix = currentText.replace(/\n+$/, "");
    return `${prefix}\n\n${heading}\n${line}`;
  }

  let insertAt = lines.length;
  for (let i = headingIndex + 1; i < lines.length; i++) {
    if (isDayHeadingLine(lines[i])) {
      insertAt = i;
      break;
    }
  }

  // Skip back over blank lines separating this day's block from the next
  // heading (or EOF) so the new line lands with the rest of this day's
  // content instead of after the blank separator.
  while (insertAt > headingIndex + 1 && lines[insertAt - 1].trim() === "") {
    insertAt--;
  }

  lines.splice(insertAt, 0, line);
  return lines.join("\n");
}
