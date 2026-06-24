import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavProgress } from "@/components/brand/nav-progress";
import { RouteOverlay } from "@/components/brand/route-overlay";
import { AuthProvider } from "@/lib/auth/auth-context";
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
      <body>
        <AuthProvider>
          <TooltipProvider delayDuration={200}>
            <NavProgress />
            <RouteOverlay />
            {children}
          </TooltipProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
