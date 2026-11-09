import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/nav";

export const metadata: Metadata = {
  title: "FINN — what changed, why it matters, who to call",
  description: "A mobile-first investment agent: a filtered daily brief, grounded research on any NSE company, and your own network woven through both.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "FINN", statusBarStyle: "default" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#edf0f3" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className="min-h-dvh">
        <div className="mx-auto min-h-dvh max-w-[460px] bg-paper pb-[calc(76px+env(safe-area-inset-bottom))] sm:border-x sm:border-line">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
