import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse, AuthError } from "@/lib/auth/server-auth";
import { canUseLocalMode } from "@/lib/config/env";
import { createServiceClient } from "@/lib/supabase/service";
import { logError, generateCorrelationId } from "@/lib/monitoring/server-logger";

/**
 * Account deletion — requires reauthentication.
 *
 * This route deletes all user-owned data from the database and storage.
 * The auth user record is deleted via the Supabase admin API, which
 * cascades to all user-owned tables (via FK ON DELETE CASCADE).
 *
 * The client must reauthenticate before calling this route (verify
 * password or OAuth rechallenge). The reauth token is sent as a header.
 *
 * Storage objects under the user's prefix are deleted via the service client.
 */

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = generateCorrelationId();

  if (canUseLocalMode()) {
    return NextResponse.json(
      { error: "Account deletion is not available in local mode. Clear local data from Settings instead." },
      { status: 400 },
    );
  }

  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  // Require confirmation in the body
  let body: { confirm?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  if (body.confirm !== "DELETE MY ACCOUNT") {
    return NextResponse.json(
      { error: 'Confirmation required. Type "DELETE MY ACCOUNT" to confirm.' },
      { status: 400 },
    );
  }

  const serviceClient = createServiceClient();
  if (!serviceClient) {
    logError({
      type: "account_delete",
      message: "Service client not configured for account deletion",
      correlationId,
      userId: user.id,
    });
    return NextResponse.json(
      { error: "Account deletion service is not configured." },
      { status: 500 },
    );
  }

  try {
    // 1. Delete storage objects under the user's prefix
    const { data: objects, error: listError } = await serviceClient
      .storage
      .from("media")
      .list(user.id, { limit: 1000 });

    if (!listError && objects && objects.length > 0) {
      const paths = objects.map((o) => `${user.id}/${o.name}`);
      await serviceClient.storage.from("media").remove(paths);
    }

    // 2. Delete the auth user — this cascades to all user-owned tables
    //    via FK ON DELETE CASCADE on user_id columns.
    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id);

    if (deleteError) {
      logError({
        type: "account_delete",
        message: `Failed to delete auth user: ${deleteError.message}`,
        correlationId,
        userId: user.id,
      });
      return NextResponse.json(
        { error: "Failed to delete account. Please contact support." },
        { status: 500 },
      );
    }

    logError({
      type: "account_delete",
      message: "Account deleted successfully",
      correlationId,
      userId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError({
      type: "account_delete",
      message: "Unexpected error during account deletion",
      error,
      correlationId,
      userId: user.id,
    });
    return NextResponse.json(
      { error: "An unexpected error occurred during account deletion." },
      { status: 500 },
    );
  }
}
