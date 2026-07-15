import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavProgress } from "@/components/brand/nav-progress";
import { RouteOverlay } from "@/components/brand/route-overlay";
import { AuthProvider } from "@/lib/auth/auth-context";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { PersistenceSync } from "@/components/sync/persistence-sync";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProfJohns — research canvas",
  description:
    "A node-based canvas for academic research. Connect sources, extract, review, and write with AI.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* Swiss type system — loaded via <link> (not CSS @import, which
            Tailwind v4 hoists past its own output and invalidates). If a CDN
            is unreachable, text falls back to the system stack; nothing blocks. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=general-sans@500,600&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        {/* Skip navigation — keyboard users can jump to main content */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-[13px] focus:font-semibold focus:text-paper"
        >
          Skip to main content
        </a>
        <AuthProvider>
          <PersistenceSync />
          <AuthGuard>
            <TooltipProvider delayDuration={200}>
              <NavProgress />
              <RouteOverlay />
              <div id="main-content">{children}</div>
            </TooltipProvider>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
