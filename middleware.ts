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
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
