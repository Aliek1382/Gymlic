// Workout plan descriptions stay free text (a trainer can always type
// directly), but the builder groups picked exercises under a "برچسب:"
// heading line within that same text instead of a separate structured
// field. The heading can be a day of week or a muscle group — both are
// just labels as far as this module is concerned.
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

function heading(label: string): string {
  return `${label}:`;
}

// A heading line is any standalone "چیزی:" line — not just a weekday —
// since headings can now also be muscle-group labels sourced from the
// exercise library.
function isHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length > 1 && trimmed.endsWith(":");
}

// Inserts `line` at the end of `label`'s block if that heading already
// exists in `currentText`, otherwise appends a new "برچسب:" section at
// the end.
export function insertExerciseLineUnderHeading(
  currentText: string,
  label: string,
  line: string
): string {
  const headingLine = heading(label);

  if (!currentText.trim()) {
    return `${headingLine}\n${line}`;
  }

  const lines = currentText.split("\n");
  const headingIndex = lines.findIndex((l) => l.trim() === headingLine);

  if (headingIndex === -1) {
    const prefix = currentText.replace(/\n+$/, "");
    return `${prefix}\n\n${headingLine}\n${line}`;
  }

  let insertAt = lines.length;
  for (let i = headingIndex + 1; i < lines.length; i++) {
    if (isHeadingLine(lines[i])) {
      insertAt = i;
      break;
    }
  }

  // Skip back over blank lines separating this block from the next
  // heading (or EOF) so the new line lands with the rest of this block's
  // content instead of after the blank separator.
  while (insertAt > headingIndex + 1 && lines[insertAt - 1].trim() === "") {
    insertAt--;
  }

  lines.splice(insertAt, 0, line);
  return lines.join("\n");
}

// Appends `line` with no heading at all — for a trainer who doesn't want
// to group exercises by day or muscle group for this entry.
export function appendExerciseLine(currentText: string, line: string): string {
  if (!currentText.trim()) return line;
  const prefix = currentText.replace(/\n+$/, "");
  return `${prefix}\n${line}`;
}
