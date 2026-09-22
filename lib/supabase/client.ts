import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database.types";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // The middleware used to catch a misconfigured environment and say so in the
  // server logs. In a static export there is no middleware and no server: these
  // values are substituted into the bundle at build time, so a build that ran
  // without them ships files with `undefined` baked in and every page fails at
  // runtime with a message from @supabase/ssr that does not say why. Naming the
  // cause here keeps a misconfigured deployment diagnosable from the browser.
  if (!url || !anonKey) {
    const missing = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ]
      .filter(Boolean)
      .join(" و ");

    throw new Error(
      `${missing} هنگام build تعریف نشده بود. این مقادیر در زمان build داخل ` +
        `فایل‌های خروجی درج می‌شوند و نه هنگام اجرا، پس تعریف‌کردن آن‌ها به‌تنهایی ` +
        `کافی نیست: بعد از تنظیم، باید دوباره build و آپلود کنید. ` +
        `در اجرای محلی، فایل .env.local را بسازید؛ روی Vercel، متغیرها باید برای ` +
        `همان محیطی (Production / Preview) تعریف شده باشند که این نسخه از آن build شده است.`
    );
  }

  return createBrowserClient<Database>(url, anonKey);
}
