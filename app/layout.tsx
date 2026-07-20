import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/providers/query-provider";
import "./globals.css";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "جیم‌لیک | مدیریت هوشمند باشگاه",
  description: "پلتفرم مدیریت باشگاه، مربی و ورزشکار",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className="antialiased">
        <QueryProvider>
          {children}
          <Toaster position="top-center" richColors dir="rtl" />
        </QueryProvider>
      </body>
    </html>
  );
}
