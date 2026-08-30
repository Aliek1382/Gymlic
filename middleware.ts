import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // manifest.webmanifest has to be excluded explicitly: browsers fetch a
  // manifest without credentials, so it arrives here cookie-less, updateSession
  // reads it as signed out and redirects it to /login. The browser then fails
  // to parse the login HTML as a manifest and the app is silently not
  // installable, for signed-in users too. Icons are already covered by the
  // image-extension rule below.
  //
  // sw.js and offline.html (matched by the "offline" prefix) are excluded for
  // the same reason. offline.html cannot instead go in PUBLIC_PATHS: that list
  // redirects *signed-in* callers on to /dashboard, and the worker stores the
  // page with cache.add(), which rejects a redirected response — so it would
  // break for exactly the users who are signed in. Excluded here it is a plain
  // static file for everyone, which is all the worker needs.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
