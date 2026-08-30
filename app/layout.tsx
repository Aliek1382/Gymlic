import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/providers/query-provider";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";
import "./globals.css";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "جیم‌لیک | مدیریت هوشمند باشگاه",
  description: "پلتفرم مدیریت باشگاه، مربی و ورزشکار",
  // iOS reads this instead of the manifest's `display` when a page is added to
  // the home screen, and without it the app opens inside Safari's chrome.
  appleWebApp: {
    capable: true,
    title: "جیم‌لیک",
    statusBarStyle: "default",
  },
  // `capable` above emits only the standardised mobile-web-app-capable. iOS
  // 16.4+ takes `display` from the manifest anyway, but older iPhones launch
  // standalone solely on this legacy tag, so it is spelled out for them.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#f4f6fb",
  // next-themes is installed but no provider mounts it, so nothing ever adds
  // .dark and the app is light-only. Declaring that keeps iOS from rendering
  // form controls against a dark palette the stylesheet never matches.
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  // Lets the page paint into the notch/home-indicator area; the components
  // that sit against those edges add the insets back explicitly.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className="antialiased">
        {/* Chrome fires beforeinstallprompt exactly once, typically before
            React has hydrated, and the event is lost if nothing is listening.
            This runs inline ahead of hydration and parks it on window for
            InstallAppPrompt to pick up. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__gymlicInstallPrompt=null;window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__gymlicInstallPrompt=e;window.dispatchEvent(new Event("gymlic:installavailable"))});`,
          }}
        />
        <QueryProvider>
          <ServiceWorkerRegistrar />
          {children}
          <Toaster position="top-center" richColors dir="rtl" />
        </QueryProvider>
      </body>
    </html>
  );
}
