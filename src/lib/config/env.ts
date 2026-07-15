/**
 * Environment configuration and validation.
 *
 * Local mode (no auth, no cloud sync, localStorage only) is gated behind an
 * explicit flag: `ALLOW_LOCAL_MODE=true`. In production and preview, missing
 * required variables fails loudly instead of silently degrading to local mode.
 */

export type AppEnvironment = "local" | "preview" | "production";

function detectEnvironment(): AppEnvironment {
  const explicit = process.env.NODE_ENV;
  const vercelEnv = process.env.VERCEL_ENV;

  if (vercelEnv === "production") return "production";
  if (vercelEnv === "preview") return "preview";
  if (explicit === "production") return "production";
  return "local";
}

export const APP_ENV: AppEnvironment = detectEnvironment();

export const IS_LOCAL = APP_ENV === "local";
export const IS_PREVIEW = APP_ENV === "preview";
export const IS_PRODUCTION = APP_ENV === "production";

/**
 * True only when local mode is explicitly allowed via `ALLOW_LOCAL_MODE=true`.
 * When this is false and Supabase env vars are missing, the app should fail
 * rather than silently running without auth.
 */
export const ALLOW_LOCAL_MODE = process.env.ALLOW_LOCAL_MODE === "true";

/**
 * Whether the app is permitted to run without Supabase (local-only mode).
 * This is true only when:
 * 1. The environment is local AND ALLOW_LOCAL_MODE is true, OR
 * 2. Supabase env vars happen to be set (so local mode is not needed)
 */
export function canUseLocalMode(): boolean {
  return IS_LOCAL && ALLOW_LOCAL_MODE;
}

/**
 * Required environment variables for cloud-enabled mode (non-local).
 * If any are missing in preview/production, the app should fail to start.
 */
export const REQUIRED_PROD_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "OPENROUTER_API_KEY",
] as const;

export const REQUIRED_CRON_VARS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
] as const;

/**
 * Validates that all required environment variables are present.
 * Returns a list of missing variable names.
 */
export function getMissingRequiredVars(): string[] {
  const missing: string[] = [];
  for (const key of REQUIRED_PROD_VARS) {
    if (!process.env[key]) missing.push(key);
  }
  return missing;
}

/**
 * Asserts that the environment is properly configured.
 * Throws if production/preview is missing required vars without ALLOW_LOCAL_MODE.
 * Call this at server startup (proxy, API routes) to fail fast.
 */
export function assertEnvironmentConfigured(): void {
  const missing = getMissingRequiredVars();
  if (missing.length === 0) return;

  if (IS_LOCAL && ALLOW_LOCAL_MODE) return;

  const envName = APP_ENV.toUpperCase();
  throw new Error(
    `[${envName}] Missing required environment variables: ${missing.join(", ")}. ` +
      `Set ALLOW_LOCAL_MODE=true for local development without Supabase, ` +
      `or configure the missing variables in your deployment environment.`,
  );
}

/**
 * The public application URL for the current environment.
 */
export const APP_URL =
  process.env.APP_URL ||
  (IS_PRODUCTION
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"
    : IS_PREVIEW
      ? process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000"
      : "http://localhost:3000");

/**
 * Rate-limit namespace prefix to prevent collisions across environments.
 */
export const RATE_LIMIT_NAMESPACE = `profjohns:${APP_ENV}`;
