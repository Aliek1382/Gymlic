import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // `id` pins the app's identity independently of `start_url`, so changing
    // the landing route later updates the installed app instead of registering
    // a second one alongside it.
    id: "/",
    name: "جیم‌لیک | مدیریت هوشمند باشگاه",
    short_name: "جیم‌لیک",
    description: "پلتفرم مدیریت باشگاه، مربی و ورزشکار",
    lang: "fa",
    dir: "rtl",
    // Middleware sends a signed-out visitor from here to /login, so the
    // installed app opens on the panel for a returning user and on the login
    // screen for everyone else.
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    // Matches the sticky header's bg-background, so the Android status bar
    // reads as an extension of the header rather than a separate band.
    background_color: "#f4f6fb",
    theme_color: "#f4f6fb",
    categories: ["business", "health", "fitness"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Android crops this one to the launcher's mask, so the mark is drawn
      // smaller than the plate to stay inside the 80% safe zone.
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
