// Reads back the free-text plan description that NutritionDayBuilder /
// FoodPicker wrote, so a nutrition plan is laid out as meal blocks and food
// rows instead of one undifferentiated paragraph — the same job
// workout-plan-parse does for a workout plan.
//
// Nothing structured is persisted (the description is a single text column),
// so this recovers the shape from the line format FoodPicker writes. Any
// line it can't recognise — a trainer typing freehand, or a plan written
// before the food library existed — falls back to a plain text row, so the
// sheet never loses content it failed to parse.
import { toAsciiDigits } from "@/lib/persian";
import { FOOD_UNITS } from "@/features/foods/constants/foods";
import { isHeadingLine } from "./workout-plan-text";
import type { ParsedTextRow } from "./workout-plan-parse";

export interface ParsedFoodRow {
  kind: "food";
  name: string;
  amount: string | null;
  unit: string | null;
  // The free note a trainer attached in parentheses, e.g. "آب‌پز".
  note: string | null;
  // The category the trainer had selected when inserting this line, when
  // they picked one at all. It rides on the row rather than the meal
  // heading so that picking the same meal twice always lands in the same
  // block.
  category: string | null;
}

export type ParsedNutritionRow = ParsedFoodRow | ParsedTextRow;

export interface ParsedMealSection {
  // The "صبحانه:" style label the builder groups foods under, minus its
  // trailing colon. Null for foods added without a heading.
  heading: string | null;
  rows: ParsedNutritionRow[];
}

const DIGITS = "[0-9۰-۹٠-٩]";
// Whole numbers plus the decimals and halves a trainer actually writes —
// "1.5 لیوان", "۱/۲ لیوان".
const AMOUNT = `${DIGITS}+(?:[.,٫/]${DIGITS}+)?`;
// An em dash, hyphen or colon between the food name and its amount. Unlike
// the workout grammar this is required in the free-unit shape: without it
// a sentence like "قبل از خواب 2 لیوان آب بنوشید" would read as a food row.
const SEP = String.raw`\s*[—–\-:]\s*`;
// Anything but digits and parentheses — the note has its own group, and a
// second number means the first one wasn't the amount.
const UNIT_TEXT = "[^()0-9۰-۹٠-٩]+?";
const NOTE = String.raw`(?:\s*\(\s*([^)]*?)\s*\))?`;
// Hand typing often drops the ZWNJ inside "میلی‌لیتر" / "چای‌خوری".
const KNOWN_UNIT = FOOD_UNITS.map((unit) =>
  unit.replace(/‌/g, "‌?")
).join("|");

const FOOD_PATTERNS = [
  // "سینه مرغ — 150 گرم (آب‌پز)" (canonical) and every separated shape it
  // subsumes, including a custom unit a trainer typed themselves and no
  // unit at all.
  new RegExp(`^(.+?)${SEP}(${AMOUNT})\\s*(${UNIT_TEXT})?${NOTE}$`),
  // "شیر کم‌چرب 1 لیوان" — with no separator to lean on, the unit has to be
  // one we recognise and has to end the line, so prose isn't read as a row.
  new RegExp(`^(.+?)\\s+(${AMOUNT})\\s*(${KNOWN_UNIT})${NOTE}$`),
];

// The optional "[منابع پروتئینی] " prefix FoodPicker puts in front of a line
// when the trainer had a category selected alongside a meal. Pulled off
// before the patterns run, so they keep matching the food name at the start
// of the line.
const CATEGORY_PREFIX = /^\s*\[([^\]]+)\]\s*/;

function splitCategory(line: string): { body: string; category: string | null } {
  const match = line.match(CATEGORY_PREFIX);
  if (!match) return { body: line, category: null };
  return { body: line.slice(match[0].length), category: match[1].trim() };
}

function parseLine(line: string): ParsedNutritionRow {
  const { body, category } = splitCategory(line);

  for (const pattern of FOOD_PATTERNS) {
    const match = body.match(pattern);
    if (!match) continue;
    const unit = match[3]?.trim();
    return {
      kind: "food",
      name: match[1].trim(),
      amount: toAsciiDigits(match[2]),
      unit: unit || null,
      note: match[4]?.trim() || null,
      category,
    };
  }

  return { kind: "text", text: line };
}

export function parseNutritionDescription(
  description: string | null | undefined
): ParsedMealSection[] {
  if (!description?.trim()) return [];

  const sections: ParsedMealSection[] = [];
  let current: ParsedMealSection | null = null;

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

// True when a section is a real food table (worth column headers) rather
// than a block of freehand notes.
export function hasFoodRows(section: ParsedMealSection): boolean {
  return section.rows.some((row) => row.kind === "food");
}

// Distinct categories across a section's food rows, in the order they first
// appear. Shown on the meal heading so what the meal is built from reads at
// a glance.
export function sectionFoodCategories(section: ParsedMealSection): string[] {
  const categories: string[] = [];
  for (const row of section.rows) {
    if (row.kind !== "food" || !row.category) continue;
    if (!categories.includes(row.category)) categories.push(row.category);
  }
  return categories;
}
