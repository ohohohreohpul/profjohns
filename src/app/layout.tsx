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
        <AuthProvider>
          <PersistenceSync />
          <AuthGuard>
            <TooltipProvider delayDuration={200}>
              <NavProgress />
              <RouteOverlay />
              {children}
            </TooltipProvider>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
