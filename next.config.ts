import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Production Content-Security-Policy.
 *
 * Uses the "without nonces" approach from the Next.js 16 docs — strict on
 * everything that can be strict (object, frame, base, form-action, images,
 * fonts, connect-src) while allowing the inline scripts/styles Next.js and
 * Tailwind v4 inject. Keeps static generation intact (nonce-based CSP would
 * force every page to dynamic rendering, which this app is not built for).
 *
 * Upgrade path: when the app is converted to fully dynamic rendering, move
 * to a per-request nonce in proxy.ts (see Next.js CSP guide) and drop
 * 'unsafe-inline' from script-src.
 */
const cspHeader = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com",
  "font-src 'self' https://fonts.gstatic.com https://api.fontshare.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://*.supabase.co",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspHeader },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;