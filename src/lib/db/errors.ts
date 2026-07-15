/**
 * Typed database error categories for repo.ts.
 *
 * Every database operation returns a typed result or throws a typed
 * application error. Supabase `error` values are NEVER discarded.
 */

export type DbErrorCategory =
  | "AUTH_EXPIRED"
  | "PERMISSION_DENIED"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "NETWORK_UNAVAILABLE"
  | "DATABASE_UNAVAILABLE"
  | "UNKNOWN_SERVER_ERROR";

export class DbError extends Error {
  constructor(
    message: string,
    public category: DbErrorCategory,
    public statusCode: number = 500,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "DbError";
  }
}

/**
 * Maps a Supabase error response to a typed DbError.
 */
export function fromSupabaseError(error: {
  code?: string;
  message: string;
  details?: unknown;
  hint?: string;
}): DbError {
  const code = error.code ?? "";

  // PostgreSQL error codes
  if (code === "23505") {
    return new DbError("A record with this key already exists.", "CONFLICT", 409);
  }
  if (code === "23503") {
    return new DbError("Referenced record does not exist.", "VALIDATION_ERROR", 400);
  }
  if (code === "42501" || code === "PGRST301") {
    return new DbError("Permission denied.", "PERMISSION_DENIED", 403);
  }
  if (code === "PGRST116" || code === "PGRST117") {
    return new DbError("Authentication required.", "AUTH_EXPIRED", 401);
  }
  if (code.startsWith("08") || code.startsWith("57")) {
    return new DbError("Database is temporarily unavailable.", "DATABASE_UNAVAILABLE", 503);
  }
  if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT") {
    return new DbError("Network connection failed.", "NETWORK_UNAVAILABLE", 503);
  }

  return new DbError(
    error.message || "An unexpected database error occurred.",
    "UNKNOWN_SERVER_ERROR",
    500,
  );
}

/**
 * Wraps a Supabase operation, checking the error field and throwing a typed
 * DbError if the operation failed.
 */
export async function checkDb<T>(
  operation: () => PromiseLike<{ data: T | null; error: { code?: string; message: string; details?: unknown; hint?: string } | null }>,
  context: string,
): Promise<T | null> {
  const result = await operation();
  if (result.error) {
    throw fromSupabaseError(result.error);
  }
  return result.data;
}

/**
 * Requires a non-null result from a database operation.
 * Throws DbError if the result is null or if the operation fails.
 */
export async function requireDb<T>(
  operation: () => PromiseLike<{ data: T | null; error: { code?: string; message: string; details?: unknown; hint?: string } | null }>,
  context: string,
): Promise<T> {
  const data = await checkDb(operation, context);
  if (data === null) {
    throw new DbError(`${context} returned no data.`, "UNKNOWN_SERVER_ERROR", 404);
  }
  return data;
}
