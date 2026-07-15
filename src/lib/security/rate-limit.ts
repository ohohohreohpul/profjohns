import { RATE_LIMIT_NAMESPACE } from "@/lib/config/env";

/**
 * In-memory rate limiter with sliding window.
 *
 * For production with multiple server instances, replace with a Redis/Upstash
 * backend. The interface is designed to be drop-in replaceable.
 *
 * Limits are namespaced by environment (RATE_LIMIT_NAMESPACE) to prevent
 * collisions between local, preview, and production.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically to prevent memory leaks.
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimitConfig {
  /** Maximum requests per window. */
  maxRequests: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

/** Default rate limits for vendor-funded routes. */
export const RATE_LIMITS = {
  ai: { maxRequests: 30, windowMs: 60_000 },       // 30/min per user
  aiWrite: { maxRequests: 10, windowMs: 60_000 },  // 10/min for write modes
  clip: { maxRequests: 20, windowMs: 60_000 },      // 20/min
  pdf: { maxRequests: 10, windowMs: 60_000 },        // 10/min
  readable: { maxRequests: 20, windowMs: 60_000 },   // 20/min
  ipDefault: { maxRequests: 60, windowMs: 60_000 }, // 60/min per IP (global)
} as const;

/**
 * Check and consume a rate limit slot.
 * Returns whether the request is allowed and remaining quota.
 */
export function checkRateLimit(
  identifier: string,
  route: string,
  config: RateLimitConfig,
): RateLimitResult {
  cleanup();

  const key = `${RATE_LIMIT_NAMESPACE}:${route}:${identifier}`;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Get the client IP from a request, accounting for common proxy headers.
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  const realIP = request.headers.get("x-real-ip");
  if (realIP) return realIP.trim();

  return "unknown";
}

/**
 * Check both per-user and per-IP rate limits.
 * Returns the first failing limit, or success if both pass.
 */
export function checkRateLimits(
  userId: string,
  ip: string,
  route: string,
  userConfig: RateLimitConfig,
  ipConfig: RateLimitConfig = RATE_LIMITS.ipDefault,
): RateLimitResult {
  // Check IP limit first (broader protection against abuse)
  const ipResult = checkRateLimit(`ip:${ip}`, route, ipConfig);
  if (!ipResult.allowed) return ipResult;

  // Then per-user limit
  return checkRateLimit(`user:${userId}`, route, userConfig);
}
