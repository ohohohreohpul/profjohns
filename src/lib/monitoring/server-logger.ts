/**
 * Server-side monitoring and logging.
 *
 * Structured logging for:
 * - Server exceptions (with correlation IDs)
 * - API latency and error rates
 * - Vendor spend monitoring
 * - Cron success/failure
 * - Database/storage usage
 *
 * PRIVACY: Never sends paper contents, drafts, prompts, writing samples,
 * or user PII to telemetry. Only metadata: timestamps, error types,
 * durations, counts, and anonymized identifiers.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  type: string;
  message: string;
  correlationId?: string;
  userId?: string;
  durationMs?: number;
  [key: string]: unknown;
}

/**
 * Generates a correlation ID for request tracing.
 */
export function generateCorrelationId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Structured logger that outputs JSON to console.
 * In production, this should be connected to a log aggregation service
 * (e.g., Vercel Observability, Datadog, Logflare).
 *
 * PRIVACY: Only metadata is logged. Never log:
 * - Paper/source content
 * - Draft text
 * - AI prompts or responses
 * - Writing samples
 * - User email or PII (use userId hash instead)
 */
export function log(entry: LogEntry): void {
  // Strip any sensitive fields that might have been accidentally included
  const sanitized: LogEntry = { ...entry };
  const sensitiveKeys = ["text", "content", "draft", "prompt", "answer", "body", "password", "token", "apiKey"];
  for (const key of sensitiveKeys) {
    if (key in sanitized) delete (sanitized as Record<string, unknown>)[key];
  }

  console.log(JSON.stringify(sanitized));
}

export function logError(params: {
  type: string;
  message: string;
  error?: unknown;
  correlationId?: string;
  userId?: string;
}): void {
  log({
    timestamp: new Date().toISOString(),
    level: "error",
    type: params.type,
    message: params.message,
    correlationId: params.correlationId,
    userId: params.userId,
    ...(params.error instanceof Error
      ? { errorMessage: params.error.message, errorStack: params.error.stack }
      : {}),
  });
}

export function logInfo(params: {
  type: string;
  message: string;
  correlationId?: string;
  userId?: string;
  [key: string]: unknown;
}): void {
  log({
    timestamp: new Date().toISOString(),
    level: "info",
    ...params,
  });
}

/**
 * Wraps an API handler with latency monitoring.
 */
export async function withMonitoring<T>(
  type: string,
  correlationId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    log({
      timestamp: new Date().toISOString(),
      level: "info",
      type: `api:${type}`,
      message: "Request completed",
      correlationId,
      durationMs: Date.now() - start,
      status: "success",
    });
    return result;
  } catch (error) {
    log({
      timestamp: new Date().toISOString(),
      level: "error",
      type: `api:${type}`,
      message: "Request failed",
      correlationId,
      durationMs: Date.now() - start,
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Unknown",
    });
    throw error;
  }
}
