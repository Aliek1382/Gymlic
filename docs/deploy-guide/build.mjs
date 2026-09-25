// Renders guide.html to gymlic-deploy-guide.pdf.
//
// Chrome does the rendering rather than a PDF library because the guide is
// Persian: getting right-to-left text, letter joining and mixed LTR code spans
// right is a typesetting problem browsers already solved. The fonts sit next to
// this file rather than being fetched, so the build works offline and produces
// the same bytes in a year.
//
//   node docs/deploy-guide/build.mjs
//   npm run docs:pdf
//
// Set CHROME to a browser path if the search below misses yours.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const input = join(here, "guide.html");
const output = join(here, "gymlic-deploy-guide.pdf");

// Any Chromium-family browser will do; all of them take --print-to-pdf.
const candidates = {
  win32: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    `${process.env.LOCALAPPDATA ?? ""}\\Google\\Chrome\\Application\\chrome.exe`,
  ],
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ],
};

// A CHROME that points nowhere is a typo worth naming, not something to hand
// to spawn and report as a render failure.
if (process.env.CHROME && !existsSync(process.env.CHROME)) {
  console.error(`\n  CHROME is set to a path that does not exist:\n    ${process.env.CHROME}\n`);
  process.exit(1);
}

const browser =
  process.env.CHROME ??
  (candidates[process.platform] ?? []).find((p) => p && existsSync(p));

if (!browser) {
  console.error(`
  No Chrome-family browser found.

  Install Chrome, or point at one you already have:

      CHROME="<path to chrome>" node docs/deploy-guide/build.mjs
`);
  process.exit(1);
}

// --virtual-time-budget waits for the web fonts to load; without it the first
// run can print the fallback face.
const result = spawnSync(
  browser,
  [
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    "--no-pdf-header-footer",
    "--virtual-time-budget=10000",
    `--print-to-pdf=${output}`,
    input,
  ],
  { stdio: ["ignore", "ignore", "pipe"] }
);

if (result.status !== 0 || !existsSync(output)) {
  console.error(result.stderr?.toString() ?? "");
  console.error(`  Rendering failed (exit ${result.status}).`);
  process.exit(1);
}

console.log(`  Wrote ${output}`);
