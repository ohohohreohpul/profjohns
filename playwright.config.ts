import { defineConfig } from "@playwright/test";

/**
 * Regression suite for the bugs that kept recurring: cross-canvas board
 * contamination, doc-editor write loss, prune-before-hydration board wipes,
 * and node select/drag behavior.
 *
 * The web server runs with Supabase env vars BLANKED so auth is disabled
 * (AuthGuard no-ops) and all persistence is pure localStorage — the layer
 * these tests pin down. Signed-in DB merge logic is covered by the pure
 * unit tests in e2e/merge-workspace.spec.ts.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: 1,
  workers: 1, // tests share one dev server + localStorage isolation via contexts
  use: {
    baseURL: "http://localhost:3211",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command:
      "NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= ALLOW_LOCAL_MODE=true pnpm exec next dev -p 3211",
    port: 3211,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
