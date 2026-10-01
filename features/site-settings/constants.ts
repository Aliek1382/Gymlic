/**
 * The panel sections the platform admin can switch off from /admin/features.
 * The keys mirror backend-php/src/Features.php, which owns their labels and
 * the API paths each one covers; this side only knows which pages belong to
 * which key, to hide the menu entry and the page.
 */
export const FEATURE_KEYS = [
  "messages",
  "tickets",
  "questionnaires",
  "nutrition",
  "supplements",
  "progress",
  "session_packages",
  "trainer_resume",
  "templates",
  "notes",
  "calendar",
  "points",
  "earnings",
  "reports",
  "club_finance",
  "support",
  "content_library",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** Panel page (and everything under it) → the section it belongs to. */
const FEATURE_PAGES: Record<string, FeatureKey> = {
  "/messages": "messages",
  "/tickets": "tickets",
  "/questionnaires": "questionnaires",
  "/nutrition": "nutrition",
  "/nutrition-programs": "nutrition",
  "/foods": "nutrition",
  "/supplements": "supplements",
  "/progress": "progress",
  "/session-packages": "session_packages",
  "/trainer-resume": "trainer_resume",
  "/templates": "templates",
  "/calendar": "calendar",
  "/points": "points",
  "/earnings": "earnings",
  "/reports": "reports",
  "/finance": "club_finance",
  "/support": "support",
  "/content-library": "content_library",
};

export function featureForPath(href: string): FeatureKey | null {
  const pathname = href.split(/[?#]/)[0];
  for (const [href, key] of Object.entries(FEATURE_PAGES)) {
    if (pathname === href || pathname.startsWith(`${href}/`)) return key;
  }
  return null;
}
