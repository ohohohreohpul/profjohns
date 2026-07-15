import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse, AuthError } from "@/lib/auth/server-auth";
import { canUseLocalMode } from "@/lib/config/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Export account data — returns a JSON download of all user-owned data.
 * Supports GDPR data portability requirements.
 */

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (canUseLocalMode()) {
    return NextResponse.json(
      { error: "Data export is not available in local mode." },
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

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database is not configured." },
      { status: 500 },
    );
  }

  const uid = user.id;

  try {
    const [
      projects,
      canvases,
      sources,
      pinnedSources,
      media,
      agents,
      standingTasks,
      findings,
      figures,
      profile,
    ] = await Promise.all([
      supabase.from("projects").select("*").eq("user_id", uid),
      supabase.from("canvases").select("*").eq("user_id", uid),
      supabase.from("sources").select("*").eq("user_id", uid),
      supabase.from("pinned_sources").select("*").eq("user_id", uid),
      supabase.from("media").select("*").eq("user_id", uid),
      supabase.from("agents").select("*").eq("user_id", uid),
      supabase.from("standing_tasks").select("*").eq("user_id", uid),
      supabase.from("findings").select("*").eq("user_id", uid),
      supabase.from("figures").select("*").eq("user_id", uid),
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      userId: uid,
      email: user.email,
      profile: profile.data,
      projects: projects.data ?? [],
      canvases: canvases.data ?? [],
      sources: sources.data ?? [],
      pinnedSources: pinnedSources.data ?? [],
      media: media.data ?? [],
      agents: agents.data ?? [],
      standingTasks: standingTasks.data ?? [],
      findings: findings.data ?? [],
      figures: figures.data ?? [],
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="profjohns-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
      },
    });
  } catch (error) {
    console.error("[Export] Failed to export account data:", error);
    return NextResponse.json(
      { error: "Failed to export account data." },
      { status: 500 },
    );
  }
}
