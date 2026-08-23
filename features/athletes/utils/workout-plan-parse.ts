// Reads back the free-text plan description that WorkoutDayBuilder /
// ExercisePicker wrote, so the printable sheet can lay it out as day blocks
// and exercise rows instead of one undifferentiated paragraph.
//
// Nothing structured is persisted (the description is a single text column),
// so this recovers the shape from the exact line formats ExercisePicker's
// buildEntry() produces. Any line it can't recognise — a trainer typing
// freehand, or a nutrition plan — falls back to a plain text row, so the
// sheet never loses content it failed to parse.
import { toAsciiDigits, toPersianDigits } from "@/lib/persian";
import { isHeadingLine } from "./workout-plan-text";
import { splitWeekdayHeading } from "./workout-plan-weekday";

export type PlanTechnique = "normal" | "superset" | "triset" | "dropset";

export interface ParsedRest {
  betweenSets: string | null;
  betweenExercises: string | null;
}

export interface ParsedMove {
  name: string;
  reps: string | null;
}

export interface ParsedExerciseRow {
  kind: "exercise";
  technique: PlanTechnique;
  moves: ParsedMove[];
  // Straight sets for "normal", rounds ("دور") for superset/tri-set.
  sets: string | null;
  // Descending rep targets of a drop-set, e.g. ["12", "10", "8"].
  drops: string[] | null;
  rest: ParsedRest;
  // The group the trainer had selected when inserting this line, when they
  // picked one at all. It rides on the row rather than the day heading so
  // that picking the same day twice always lands in the same block.
  muscleGroup: string | null;
}

export interface ParsedTextRow {
  kind: "text";
  text: string;
}

export type ParsedRow = ParsedExerciseRow | ParsedTextRow;

export interface ParsedSection {
  // The "شنبه — پا:" style label the builder groups exercises under, minus
  // its trailing colon. Null for exercises added without a heading.
  heading: string | null;
  rows: ParsedRow[];
}

const TECHNIQUE_LABELS: Record<PlanTechnique, string | null> = {
  normal: null,
  superset: "سوپرست",
  triset: "تری‌ست",
  dropset: "دراپ‌ست",
};

export function techniqueLabel(technique: PlanTechnique): string | null {
  return TECHNIQUE_LABELS[technique];
}

// The optional "(استراحت بین ست‌ها: ...، استراحت بین حرکات: ...)" tail that
// restSuffix() appends to every technique's line.
const REST_SUFFIX = /\s*\(\s*استراحت[^)]*\)\s*$/;

// ---------------------------------------------------------------------------
// Line grammar
//
// ExercisePicker writes one canonical shape per technique, but a trainer may
// also type straight into the description box, so each technique accepts a
// few equivalent shapes. They're tried in order and the first match wins;
// every shape lands on the same ParsedExerciseRow, so the table, badges and
// printed sheet look identical no matter which one was written.
// ---------------------------------------------------------------------------

// Matches ASCII digits alongside Persian (۰-۹) and Arabic-Indic (٠-٩) ones —
// a trainer typing a number by hand on a Persian keyboard usually gets one
// of the latter two, not ASCII. Captured groups are normalized back to ASCII
// with toAsciiDigits() so they render exactly like a number the picker wrote.
const DIGITS = "[0-9۰-۹٠-٩]";
const NON_DIGIT = "[^0-9۰-۹٠-٩]";

// The bare rest note a trainer types by hand — "… استراحت 60 ثانیه" — with no
// parentheses, comma or dash. The word itself is what makes this safe to read
// off the end of a line: it is only ever stripped from a line that goes on to
// match an exercise shape, and a line that doesn't keeps its original text.
// Any words between the word and the number (e.g. "بین حرکات") pick which
// rest it is; anything else falls to the between-sets reading, the common one.
const REST_BARE = new RegExp(
  `\\s+استراحت\\s*(${NON_DIGIT}*)\\s*(${DIGITS}+)\\s*(ثانیه|دقیقه)\\s*$`
);

// Between an exercise name and its numbers: an em dash, hyphen or colon, or
// nothing at all. SEP_REQUIRED is used by the one shape that would otherwise
// end in a bare number, so "دستگاه شماره 2" isn't read as name + 2 reps.
const SEP = String.raw`\s*[—–\-:]?\s*`;
const SEP_REQUIRED = String.raw`\s*[—–\-:]\s*`;
// "تکرار", its casual short form "تا", or omitted entirely.
const REPS_WORD = "(?:تکرار|تا)";
// Hand typing often drops the ZWNJ inside "تری‌ست" / "دراپ‌ست".
const ZWNJ = String.raw`‌?`;
const TIMES = "[×xX]";

// A single straight-sets exercise: name, set count, rep count.
const SINGLE_PATTERNS = [
  // "پرس سینه — 4 ست × 12 تکرار" (canonical), and the looser hand-typed
  // shapes it subsumes: no separator, no ×, "تا" for "تکرار", or no word.
  new RegExp(
    `^(.+?)${SEP}(${DIGITS}+)\\s*ست\\s*(?:${TIMES}\\s*)?(${DIGITS}+)\\s*${REPS_WORD}?$`
  ),
  // "پرس سینه — 4x12"
  new RegExp(`^(.+?)${SEP}(${DIGITS}+)\\s*${TIMES}\\s*(${DIGITS}+)\\s*${REPS_WORD}?$`),
  // "پرس سینه: 4/12"
  new RegExp(`^(.+?)${SEP}(${DIGITS}+)\\s*/\\s*(${DIGITS}+)\\s*${REPS_WORD}?$`),
];

// A superset / tri-set line, whose round count covers every move in it.
const MULTI_LINE_PATTERNS = [
  new RegExp(
    `^(سوپرست|تری${ZWNJ}ست)\\s*\\(\\s*(${DIGITS}+)\\s*دور\\s*\\)\\s*:\\s*(.+)$`
  ),
  new RegExp(`^(سوپرست|تری${ZWNJ}ست)\\s*(${DIGITS}+)\\s*دور\\s*:\\s*(.+)$`),
];

// Moves within a superset are joined by "+" or a standalone "و". The spaces
// around "و" are required: without them any name containing the letter would
// be torn apart.
const MULTI_CONNECTOR = /\s*\+\s*|\s+و\s+/;

// One move inside a superset — reps only, since the line's round count is
// what covers sets.
const MOVE_PATTERNS = [
  // "پرس سینه × 12 تکرار" (canonical), "پرس سینه x12"
  new RegExp(`^(.+?)\\s*${TIMES}\\s*(${DIGITS}+)\\s*${REPS_WORD}?$`),
  // "پرس سینه 4 ست 12 تکرار" — a per-move set count is accepted but ignored,
  // because the line's own "N دور" is what actually applies.
  new RegExp(
    `^(.+?)${SEP}${DIGITS}+\\s*ست\\s*(?:${TIMES}\\s*)?(${DIGITS}+)\\s*${REPS_WORD}?$`
  ),
  // "پرس سینه 12 تکرار" / "پرس سینه 12 تا"
  new RegExp(`^(.+?)${SEP}(${DIGITS}+)\\s*${REPS_WORD}$`),
  // "پرس سینه: 12" — separator required, per SEP_REQUIRED above.
  new RegExp(`^(.+?)${SEP_REQUIRED}(${DIGITS}+)$`),
];

const DROPSET_PATTERNS = [
  new RegExp(
    `^(.+?)${SEP}دراپ${ZWNJ}ست\\s*:\\s*(.+?)\\s*${REPS_WORD}?\\s*(?:\\([^)]*\\))?$`
  ),
];

// The descending rep targets of a drop-set. "←" is what the picker writes;
// the rest are what's reachable from a keyboard.
const DROP_SEPARATOR = /[←،,\-]/;

function matchFirst(body: string, patterns: RegExp[]): RegExpMatchArray | null {
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) return match;
  }
  return null;
}

// The optional "[پا] " prefix ExercisePicker puts in front of a line when the
// trainer had a muscle group selected alongside a weekday.
const MUSCLE_PREFIX = /^\s*\[([^\]]+)\]\s*/;

const EMPTY_REST: ParsedRest = { betweenSets: null, betweenExercises: null };

// Pulled off before any technique pattern runs, so those keep matching the
// exercise name at the start of the line exactly as they did before the
// prefix existed.
function splitMuscleGroup(line: string): {
  body: string;
  muscleGroup: string | null;
} {
  const match = line.match(MUSCLE_PREFIX);
  if (!match) return { body: line, muscleGroup: null };
  return { body: line.slice(match[0].length), muscleGroup: match[1].trim() };
}

function splitRest(line: string): { body: string; rest: ParsedRest } {
  // The parenthesised form ExercisePicker writes, which can carry both rests
  // at once, is tried first.
  const match = line.match(REST_SUFFIX);
  if (match && match.index !== undefined) {
    const rest: ParsedRest = { betweenSets: null, betweenExercises: null };
    const inner = match[0].trim().slice(1, -1);
    for (const part of inner.split("،")) {
      const separator = part.indexOf(":");
      if (separator === -1) continue;
      const label = part.slice(0, separator);
      const value = part.slice(separator + 1).trim();
      // "حرکات" is checked first because "استراحت" itself contains the
      // substring "ست", which would otherwise match both labels.
      if (label.includes("حرکات")) rest.betweenExercises = value;
      else if (label.includes("ست")) rest.betweenSets = value;
    }

    return { body: line.slice(0, match.index).trim(), rest };
  }

  const bare = line.match(REST_BARE);
  if (bare && bare.index !== undefined) {
    // Rendered raw next to picker-written values like "۹۰ ثانیه", so the
    // number is normalized to Persian digits to sit beside them unchanged.
    const value = `${toPersianDigits(toAsciiDigits(bare[2]))} ${bare[3]}`;
    // Both spellings, since "حرکات" does not contain "حرکت" — the alef sits
    // between the kaf and the te.
    const label = bare[1];
    const betweenMoves = label.includes("حرکات") || label.includes("حرکت");
    const rest: ParsedRest = betweenMoves
      ? { betweenSets: null, betweenExercises: value }
      : { betweenSets: value, betweenExercises: null };

    return { body: line.slice(0, bare.index).trim(), rest };
  }

  return { body: line, rest: EMPTY_REST };
}

function parseLine(line: string): ParsedRow {
  const { body: unprefixed, muscleGroup } = splitMuscleGroup(line);
  const { body, rest } = splitRest(unprefixed);

  const multi = matchFirst(body, MULTI_LINE_PATTERNS);
  if (multi) {
    const moves: ParsedMove[] = [];
    for (const part of multi[3].split(MULTI_CONNECTOR)) {
      const move = matchFirst(part.trim(), MOVE_PATTERNS);
      // A half-recognised group would silently drop exercises, so bail out
      // to a text row and keep the trainer's line intact instead. This is
      // also what catches a "و" that belonged to a name rather than joining
      // two moves — the stray half has no reps, so nothing is invented.
      if (!move) return { kind: "text", text: line };
      moves.push({ name: move[1].trim(), reps: toAsciiDigits(move[2]) });
    }
    return {
      kind: "exercise",
      technique: multi[1] === "سوپرست" ? "superset" : "triset",
      moves,
      sets: toAsciiDigits(multi[2]),
      drops: null,
      rest,
      muscleGroup,
    };
  }

  const dropset = matchFirst(body, DROPSET_PATTERNS);
  if (dropset) {
    const drops = dropset[2]
      .split(DROP_SEPARATOR)
      .map((drop) => toAsciiDigits(drop.trim()))
      .filter(Boolean);
    // A single value isn't a drop-set — treat the line as prose rather than
    // rendering a one-step "drop".
    if (drops.length >= 2) {
      return {
        kind: "exercise",
        technique: "dropset",
        moves: [{ name: dropset[1].trim(), reps: null }],
        sets: null,
        drops,
        rest,
        muscleGroup,
      };
    }
  }

  const single = matchFirst(body, SINGLE_PATTERNS);
  if (single) {
    return {
      kind: "exercise",
      technique: "normal",
      moves: [{ name: single[1].trim(), reps: toAsciiDigits(single[3]) }],
      sets: toAsciiDigits(single[2]),
      drops: null,
      rest,
      muscleGroup,
    };
  }

  return { kind: "text", text: line };
}

// Plans written before the muscle group moved onto the exercise line carry
// headings like "شنبه — پا", so a single day could span several rival blocks
// that read as separate days. Those are folded back together here: the day
// alone becomes the heading, and the group from the old heading tags the rows
// that don't already carry one, so an existing plan renders exactly like a
// newly written one — in the app and on the printed sheet alike.
//
// Only headings that actually start with a weekday are merged; a program
// grouped purely by muscle group keeps each block as its own section.
function mergeSectionsByWeekday(sections: ParsedSection[]): ParsedSection[] {
  const merged: ParsedSection[] = [];
  const byWeekday = new Map<string, ParsedSection>();

  for (const section of sections) {
    const split = section.heading ? splitWeekdayHeading(section.heading) : null;
    if (!split) {
      merged.push(section);
      continue;
    }

    const { weekday, label } = split;
    const rows = label
      ? section.rows.map((row) =>
          row.kind === "exercise" && row.muscleGroup === null
            ? { ...row, muscleGroup: label }
            : row
        )
      : section.rows;

    const existing = byWeekday.get(weekday);
    if (existing) {
      existing.rows.push(...rows);
      continue;
    }

    // The heading is normalised to the canonical weekday so a day keys its
    // tick the same way however its heading was originally spelled.
    const next: ParsedSection = { heading: weekday, rows: [...rows] };
    byWeekday.set(weekday, next);
    merged.push(next);
  }

  return merged;
}

export function parsePlanDescription(
  description: string | null | undefined
): ParsedSection[] {
  if (!description?.trim()) return [];

  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;

  for (const rawLine of description.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    if (isHeadingLine(line)) {
      current = { heading: line.slice(0, -1).trim(), rows: [] };
      sections.push(current);
      continue;
    }

    if (!current) {
      current = { heading: null, rows: [] };
      sections.push(current);
    }
    current.rows.push(parseLine(line));
  }

  return mergeSectionsByWeekday(sections);
}

// True when a section is a real exercise table (worth column headers) rather
// than a block of freehand notes.
export function hasExerciseRows(section: ParsedSection): boolean {
  return section.rows.some((row) => row.kind === "exercise");
}

// Distinct muscle groups across a section's exercise rows, in the order they
// first appear. Shown on the day heading so what the day covers reads at a
// glance — derived from the rows rather than stored in the heading, which is
// what keeps the heading stable enough to key a day's tick by.
export function sectionMuscleGroups(section: ParsedSection): string[] {
  const groups: string[] = [];
  for (const row of section.rows) {
    if (row.kind !== "exercise" || !row.muscleGroup) continue;
    if (!groups.includes(row.muscleGroup)) groups.push(row.muscleGroup);
  }
  return groups;
}
