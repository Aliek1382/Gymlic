// Reads back the free-text plan description that WorkoutDayBuilder /
// ExercisePicker wrote, so the printable sheet can lay it out as day blocks
// and exercise rows instead of one undifferentiated paragraph.
//
// Nothing structured is persisted (the description is a single text column),
// so this recovers the shape from the exact line formats ExercisePicker's
// buildEntry() produces. Any line it can't recognise — a trainer typing
// freehand, or a nutrition plan — falls back to a plain text row, so the
// sheet never loses content it failed to parse.
import { isHeadingLine } from "./workout-plan-text";

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
const MULTI_LINE = /^(سوپرست|تری‌ست)\s*\(\s*(\d+)\s*دور\s*\)\s*:\s*(.+)$/;
const MULTI_MOVE = /^(.+?)\s*×\s*(\d+)\s*تکرار$/;
const NORMAL_LINE = /^(.+?)\s+—\s+(\d+)\s*ست\s*×\s*(\d+)\s*تکرار$/;
const DROPSET_LINE = /^(.+?)\s+—\s+دراپ‌ست\s*:\s*(.+?)\s*تکرار(?:\s*\([^)]*\))?$/;

const EMPTY_REST: ParsedRest = { betweenSets: null, betweenExercises: null };

function splitRest(line: string): { body: string; rest: ParsedRest } {
  const match = line.match(REST_SUFFIX);
  if (!match || match.index === undefined) return { body: line, rest: EMPTY_REST };

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

function parseLine(line: string): ParsedRow {
  const { body, rest } = splitRest(line);

  const multi = body.match(MULTI_LINE);
  if (multi) {
    const moves: ParsedMove[] = [];
    for (const part of multi[3].split("+")) {
      const move = part.trim().match(MULTI_MOVE);
      // A half-recognised group would silently drop exercises, so bail out
      // to a text row and keep the trainer's line intact instead.
      if (!move) return { kind: "text", text: line };
      moves.push({ name: move[1].trim(), reps: move[2] });
    }
    return {
      kind: "exercise",
      technique: multi[1] === "سوپرست" ? "superset" : "triset",
      moves,
      sets: multi[2],
      drops: null,
      rest,
    };
  }

  const dropset = body.match(DROPSET_LINE);
  if (dropset) {
    return {
      kind: "exercise",
      technique: "dropset",
      moves: [{ name: dropset[1].trim(), reps: null }],
      sets: null,
      drops: dropset[2].split("←").map((drop) => drop.trim()).filter(Boolean),
      rest,
    };
  }

  const normal = body.match(NORMAL_LINE);
  if (normal) {
    return {
      kind: "exercise",
      technique: "normal",
      moves: [{ name: normal[1].trim(), reps: normal[3] }],
      sets: normal[2],
      drops: null,
      rest,
    };
  }

  return { kind: "text", text: line };
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

  return sections;
}

// True when a section is a real exercise table (worth column headers) rather
// than a block of freehand notes.
export function hasExerciseRows(section: ParsedSection): boolean {
  return section.rows.some((row) => row.kind === "exercise");
}
