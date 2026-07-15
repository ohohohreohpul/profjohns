import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { newCandidates, isDue, type StandingTask, type Schedule } from "@/lib/watch";
import type { PaperSource } from "@/lib/mock";
import type { SourceProvider } from "@/lib/sources-client";
import { timingSafeEqual } from "crypto";

/**
 * Background sweep (VISION Phase 4 — "work while you sleep").
 *
 * FAIL-CLOSED authentication:
 *   - CRON_SECRET MUST be configured
 *   - Authorization header MUST match it (constant-time comparison)
 *   - SUPABASE_SERVICE_ROLE_KEY MUST be configured
 *
 * If any required configuration is missing, the route returns an error and
 * performs no work.
 *
 * Execution locking prevents overlapping runs from processing the same tasks.
 * Each run is recorded with duration, tasks processed, failures, and findings.
 */

export const maxDuration = 60;

const PROVIDER_PATH: Record<SourceProvider, string> = {
  openalex: "/api/openalex",
  arxiv: "/api/arxiv",
  semanticscholar: "/api/semantic-scholar",
  wikipedia: "/api/wikipedia",
};

const MAX_PROVIDERS = 2;
const PER_PROVIDER = 6;
const MAX_STORE = 12;

// In-memory execution lock (prevents overlapping within the same instance).
// For multi-instance deployments, upgrade to a database-based advisory lock.
let executionLocked = false;

function taskFromRow(r: Record<string, unknown>): StandingTask {
  return {
    id: String(r.id),
    projectId: r.project_id ? String(r.project_id) : undefined,
    topic: String(r.topic ?? ""),
    sources: Array.isArray(r.sources) ? (r.sources as SourceProvider[]) : [],
    agentId: r.agent_id ? String(r.agent_id) : undefined,
    schedule: String(r.schedule ?? "daily") as Schedule,
    enabled: Boolean(r.enabled),
    lastRunAt: r.last_run_at ? Date.parse(String(r.last_run_at)) || undefined : undefined,
    createdAt: Date.parse(String(r.created_at)) || 0,
    updatedAt: Date.parse(String(r.updated_at)) || 0,
  };
}

async function searchTopic(
  appUrl: string,
  task: StandingTask,
): Promise<PaperSource[]> {
  const providers = (task.sources.length ? task.sources : ["openalex"]).slice(
    0,
    MAX_PROVIDERS,
  ) as SourceProvider[];
  const found: PaperSource[] = [];
  for (const provider of providers) {
    try {
      const res = await fetch(
        `${appUrl}${PROVIDER_PATH[provider]}?q=${encodeURIComponent(task.topic)}`,
      );
      const json = (await res.json()) as { data?: PaperSource[] };
      if (Array.isArray(json.data)) found.push(...json.data.slice(0, PER_PROVIDER));
    } catch {
      // one provider failing shouldn't abort the sweep
    }
  }
  return found;
}

/**
 * Constant-time string comparison to prevent timing attacks on the secret.
 */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

interface RunRecord {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  tasksProcessed: number;
  findingsAdded: number;
  failures: number;
  failureDetails: string[];
}

/**
 * Validates cron authentication. Returns null on success, or an error
 * NextResponse on failure. FAIL-CLOSED: missing config returns an error.
 */
function validateCronAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // FAIL-CLOSED: both must be configured
  if (!secret) {
    console.error("[CRON] CRON_SECRET is not configured. Refusing to run.");
    return NextResponse.json(
      { success: false, error: "Cron secret is not configured." },
      { status: 500 },
    );
  }

  if (!serviceKey) {
    console.error("[CRON] SUPABASE_SERVICE_ROLE_KEY is not configured. Refusing to run.");
    return NextResponse.json(
      { success: false, error: "Service role key is not configured." },
      { status: 500 },
    );
  }

  // Constant-time comparison of the Authorization header
  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  if (!authHeader || !safeCompare(authHeader, expected)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  return null;
}

/**
 * Records a cron run to structured logging (and a database table once created).
 */
function recordRun(record: RunRecord): void {
  console.log(JSON.stringify({ type: "cron-run", ...record }));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runSweep(request);
}

// GET is kept for Vercel Cron compatibility (it only sends GET).
export async function GET(request: NextRequest): Promise<NextResponse> {
  return runSweep(request);
}

async function runSweep(request: NextRequest): Promise<NextResponse> {
  // 1. Validate authentication (fail-closed)
  const authError = validateCronAuth(request);
  if (authError) return authError;

  // 2. Check execution lock
  if (executionLocked) {
    return NextResponse.json(
      { success: false, error: "A cron run is already in progress." },
      { status: 409 },
    );
  }

  executionLocked = true;
  const startedAt = new Date();
  const failureDetails: string[] = [];
  let ranTasks = 0;
  let newFindings = 0;
  let failures = 0;

  try {
    const sb = createServiceClient();
    if (!sb) {
      // This should have been caught by validateCronAuth, but double-check
      return NextResponse.json(
        { success: false, error: "Service client not available." },
        { status: 500 },
      );
    }

    const now = Date.now();
    const appUrl = process.env.APP_URL ?? new URL(request.url).origin;

    const { data: rows, error: fetchError } = await sb
      .from("standing_tasks")
      .select("*")
      .eq("enabled", true);

    if (fetchError) {
      throw new Error(`Failed to fetch standing tasks: ${fetchError.message}`);
    }

    const due = (rows ?? []).map(taskFromRow).filter((t) => isDue(t, now));

    for (const task of due) {
      try {
        const found = await searchTopic(appUrl, task);
        const { data: knownRows } = await sb
          .from("findings")
          .select("source_id")
          .eq("task_id", task.id);
        const knownIds = (knownRows ?? []).map((r) => String((r as Record<string, unknown>).source_id));
        const fresh = newCandidates(found, knownIds).slice(0, MAX_STORE);

        if (fresh.length > 0) {
          const uid = (rows ?? []).find((r) => String((r as Record<string, unknown>).id) === task.id) as
            | Record<string, unknown>
            | undefined;
          const userIdValue = uid ? String(uid.user_id) : null;
          if (userIdValue) {
            const { error: upsertError } = await sb.from("findings").upsert(
              fresh.map((s) => ({
                user_id: userIdValue,
                task_id: task.id,
                source_id: s.id,
                title: s.title,
                authors: s.authors ?? "",
                year: s.year ?? null,
                url: s.url ?? "",
                status: "new",
                data: s,
              })),
              { onConflict: "task_id,source_id", ignoreDuplicates: true },
            );
            if (upsertError) {
              throw new Error(`Failed to upsert findings for task ${task.id}: ${upsertError.message}`);
            }
            newFindings += fresh.length;
          }
        }

        await sb
          .from("standing_tasks")
          .update({ last_run_at: new Date(now).toISOString() })
          .eq("id", task.id);
        ranTasks += 1;
      } catch (err) {
        // Isolate per-task failures so one bad task doesn't stop the sweep
        failures += 1;
        const detail = err instanceof Error ? err.message : "Unknown error";
        failureDetails.push(`Task ${task.id}: ${detail}`);
        console.error(`[CRON] Task ${task.id} failed:`, detail);
      }
    }

    const finishedAt = new Date();
    recordRun({
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      tasksProcessed: ranTasks,
      findingsAdded: newFindings,
      failures,
      failureDetails,
    });

    return NextResponse.json({
      success: true,
      ranTasks,
      newFindings,
      failures,
    });
  } catch (error) {
    failures += 1;
    const detail = error instanceof Error ? error.message : "Unknown error";
    failureDetails.push(`Sweep error: ${detail}`);

    const finishedAt = new Date();
    recordRun({
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      tasksProcessed: ranTasks,
      findingsAdded: newFindings,
      failures,
      failureDetails,
    });

    return NextResponse.json(
      { success: false, error: "Sweep failed.", failures },
      { status: 500 },
    );
  } finally {
    executionLocked = false;
  }
}
