/**
 * The admin's main color (settings → branding) applied over the stylesheet's
 * own: every CSS variable derived from the primary blue in app/globals.css is
 * set again on <html>, so the whole panel follows without a rebuild.
 *
 * The computed variables are also kept in localStorage, and an inline script
 * in app/layout.tsx (BRAND_BOOT_SCRIPT) puts them back before the first
 * paint, so a returning visitor doesn't see Gymlic's blue flash first.
 */

const STORAGE_KEY = "gymlic.brand";

/** Every variable the stylesheet derives from its primary color. */
const VARIABLES = [
  "--primary",
  "--primary-foreground",
  "--primary-deep",
  "--accent",
  "--accent-foreground",
  "--info",
  "--info-muted",
  "--ring",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--chart-1",
  "--chart-2",
] as const;

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function toHex(rgb: number[]): string {
  return `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

/** $amount of $hex over white (0..1). */
function tint(hex: string, amount: number): string {
  return toHex(channels(hex).map((c) => 255 - (255 - c) * amount));
}

/** $hex darkened toward black, keeping $amount of it (0..1). */
function shade(hex: string, amount: number): string {
  return toHex(channels(hex).map((c) => c * amount));
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast of $hex against white, as the API checks it before saving. */
export function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05);
}

export function isBrandColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

/** The variables for one main color. */
export function brandVariables(hex: string): Record<string, string> {
  const color = hex.toLowerCase();
  // Whichever reads better on the color: white, or a near-black.
  const onWhite = contrastWithWhite(color);
  const onDark = (luminance(color) + 0.05) / (luminance("#111827") + 0.05);
  const foreground = onWhite >= onDark ? "#ffffff" : "#111827";
  const soft = tint(color, 0.1);
  return {
    "--primary": color,
    "--primary-foreground": foreground,
    "--primary-deep": shade(color, 0.55),
    "--accent": soft,
    "--accent-foreground": color,
    "--info": color,
    "--info-muted": soft,
    "--ring": color,
    "--sidebar-primary": color,
    "--sidebar-primary-foreground": foreground,
    "--sidebar-accent": soft,
    "--sidebar-accent-foreground": color,
    "--chart-1": color,
    "--chart-2": tint(color, 0.3),
  };
}

/** Sets (or, with no color, removes) the brand color on the page and remembers it for the next load. */
export function applyBrandColor(hex: string | null): void {
  if (typeof document === "undefined") return;
  const style = document.documentElement.style;
  const vars = hex && isBrandColor(hex) ? brandVariables(hex) : null;
  for (const name of VARIABLES) {
    if (vars) style.setProperty(name, vars[name]);
    else style.removeProperty(name);
  }
  try {
    if (vars) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(vars));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Only costs the early paint on the next load.
  }
}

/**
 * Runs inline before React hydrates: the variables saved by the last
 * visit. Self-contained (no imports), and silent on any failure.
 */
export const BRAND_BOOT_SCRIPT = `try{var b=JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})||"null");if(b&&typeof b==="object"){for(var k in b){if(/^--[a-z0-9-]+$/.test(k)&&/^#[0-9a-f]{6}$/.test(b[k]))document.documentElement.style.setProperty(k,b[k])}}}catch(e){}`;
