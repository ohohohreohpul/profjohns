/**
 * Usage recording for vendor-funded API calls.
 *
 * Records vendor, model, request type, estimated cost, actual token usage,
 * status, and user. This data powers spend monitoring (OPS-002) and
 * fair-use enforcement (BILL-003).
 *
 * Until the usage_events table exists (BILL-002), records are logged to
 * console in a structured format. When the table is ready, the logging
 * line is replaced with a database insert.
 */

export interface UsageRecord {
  userId: string;
  vendor: "openrouter" | "replicate" | "unpdf" | "internal";
  model: string | null;
  requestType: string;
  estimatedCostUsd: number | null;
  actualTokenUsage: number | null;
  status: "success" | "error" | "rate_limited" | "rejected" | "timeout";
  errorMessage: string | null;
  durationMs: number;
  timestamp: string;
}

/**
 * Estimated cost per 1K tokens for OpenRouter models (approximate, in USD).
 * Used for spend monitoring before the billing system tracks actual costs.
 */
const COST_PER_1K_TOKENS: Record<string, number> = {
  "anthropic/claude-haiku-4.5": 0.001,
  "anthropic/claude-sonnet-4": 0.009,
  "anthropic/claude-opus-4": 0.045,
};

export function estimateTokenCost(model: string, tokens: number): number | null {
  const costPer1K = COST_PER_1K_TOKENS[model];
  if (!costPer1K) return null;
  return (tokens / 1000) * costPer1K;
}

/**
 * Records a usage event. Currently logs to console; will insert into
 * the usage_events table once BILL-002 creates it.
 */
export async function recordUsage(record: UsageRecord): Promise<void> {
  // TODO (BILL-002): Insert into usage_events table via service client.
  // For now, structured logging that can be collected by the monitoring layer.
  console.log(JSON.stringify({
    type: "usage",
    ...record,
  }));
}

/**
 * Wraps a vendor API call with usage tracking and timeout.
 * Returns the result and usage data, or throws on timeout/error.
 */
export async function withUsageTracking<T>(
  params: {
    userId: string;
    vendor: UsageRecord["vendor"];
    model: string | null;
    requestType: string;
    timeoutMs?: number;
  },
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<{ result: T; usage: Partial<UsageRecord> }> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutMs = params.timeoutMs ?? 30_000;

  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await fn(controller.signal);
    const durationMs = Date.now() - startTime;

    await recordUsage({
      userId: params.userId,
      vendor: params.vendor,
      model: params.model,
      requestType: params.requestType,
      estimatedCostUsd: null,
      actualTokenUsage: null,
      status: "success",
      errorMessage: null,
      durationMs,
      timestamp: new Date().toISOString(),
    });

    return { result, usage: { durationMs } };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const isTimeout = error instanceof Error && error.name === "AbortError";

    await recordUsage({
      userId: params.userId,
      vendor: params.vendor,
      model: params.model,
      requestType: params.requestType,
      estimatedCostUsd: null,
      actualTokenUsage: null,
      status: isTimeout ? "timeout" : "error",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      durationMs,
      timestamp: new Date().toISOString(),
    });

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Sanitizes vendor error messages so raw vendor responses (which may contain
 * API keys in error echoes or internal details) never reach the client.
 */
export function sanitizeVendorError(vendor: string, status: number): string {
  if (status === 429) return "The AI service is busy. Please try again in a moment.";
  if (status >= 500) return `The ${vendor} service is temporarily unavailable. Please try again.`;
  if (status === 401 || status === 403) return "Service configuration error. Please contact support.";
  return `Request to ${vendor} failed (${status}). Please try again.`;
}
