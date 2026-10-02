// Checks that the server's TrainingWeek (src/TrainingWeek.php, used by the
// Excel report) counts training days and streaks exactly as the panel does
// in the browser (features/athletes/utils). Runs both on the same input.
// Local only:  node backend-php/tests/training-week-parity.mjs
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const jiti = createJiti(import.meta.url, { alias: { "@": root } });
const { parsePlanDescription } = await jiti.import(`${root}/features/athletes/utils/workout-plan-parse.ts`);
const { computeWeekStreak } = await jiti.import(`${root}/features/athletes/utils/streak.ts`);

const NBSP = "\u00a0";
const plans = [
  null,
  "",
  "بدون عنوان\nاسکوات 3x10",
  "شنبه:\nاسکوات 3x10\nدوشنبه:\nپرس سینه 4x8\nچهارشنبه:\nددلیفت 3x5",
  "شنبه — پا:\nاسکوات\nشنبه — سرشانه:\nپرس سرشانه\nیکشنبه - سینه:\nپرس",
  "سه‌شنبه:\na\nسه شنبه:\nb\nسهشنبه — پشت:\nc",
  "پا:\nا\nسینه:\nب\nپا:\nج",
  "  پنجشنبه:  \r\na\r\nجمعه:\r\n" + NBSP + "شنبه:" + NBSP,
  "شنبه‌ها:\nx\nشنبه2:\ny\n:\nz\nیک:\nw",
  "دوشنبه، کل بدن:\nx\nدوشنبه,پا:\ny",
  "Day 1:\nx\nشنبه\nno colon",
];
const js = plans.map((d) => parsePlanDescription(d).filter((s) => s.heading !== null).length);

const today = "2026-10-01";
const now = new Date(`${today}T12:00:00`);
const day = (offset) => {
  const d = new Date(now);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const streaks = [
  [],
  [day(-5), day(-4), day(-3)],
  [day(0), day(-1), day(-2), day(-7), day(-8), day(-9)],
  [day(-7), day(-8), day(-9), day(-14), day(-15), day(-16), day(-28), day(-29), day(-30)],
  [day(-7), day(-7), day(-8), day(-9)],
  [day(-3), day(-10), day(-11), day(-12), day(-13)],
];
const jsStreaks = streaks.map((dates) =>
  computeWeekStreak(dates.map((completedOn, i) => ({ id: String(i), assignmentId: "a", dayKey: "d", completedOn })), now).current
);

const php = JSON.parse(
  execFileSync("php", ["-r", `
    require '${root}/backend-php/src/TrainingWeek.php';
    $in = json_decode(stream_get_contents(STDIN), true);
    echo json_encode([
      array_map(fn ($d) => Gymlic\\TrainingWeek::sessionsPerWeek($d), $in['plans']),
      array_map(fn ($s) => Gymlic\\TrainingWeek::streak($s, $in['today']), $in['streaks']),
    ]);
  `], { input: JSON.stringify({ plans, streaks, today }) }).toString()
);

let failed = 0;
plans.forEach((p, i) => {
  if (js[i] !== php[0][i]) { failed++; console.log(`✘ plan ${i}: browser ${js[i]}, server ${php[0][i]}`, JSON.stringify(p)); }
});
streaks.forEach((s, i) => {
  if (jsStreaks[i] !== php[1][i]) { failed++; console.log(`✘ streak ${i}: browser ${jsStreaks[i]}, server ${php[1][i]}`, s); }
});
console.log(failed === 0 ? `✔ ${plans.length} plans and ${streaks.length} streaks count the same` : `${failed} mismatch(es)`);
process.exit(failed === 0 ? 0 : 1);
