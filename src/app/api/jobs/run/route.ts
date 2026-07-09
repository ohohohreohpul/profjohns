import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { newCandidates, isDue, type StandingTask, type Schedule } from "@/lib/watch";
import type { PaperSource } from "@/lib/mock";
import type { SourceProvider } from "@/lib/sources-client";

/**
 * Background sweep (VISION Phase 4 — "work while you sleep").
 *
 * Invoked by Vercel Cron (see vercel.json). Runs with the SERVICE ROLE — no
 * user session — so it can process every user's due standing tasks. For each
 * due task it searches the topic across the app's own provider routes, dedups
 * against the task's prior findings, and stores the new ones. AI relevance
 * scoring is left to the interactive "Run now"; the sweep just surfaces new
 * sources (a deliberate cost/robustness choice for v1).
 *
 * DEPLOY-ONLY: needs SUPABASE_SERVICE_ROLE_KEY (+ optional CRON_SECRET) set on
 * the deployment. No-ops safely when the service role isn't configured.
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Vercel sets `Authorization: Bearer <CRON_SECRET>` on cron invocations when
  // CRON_SECRET is configured — reject anything else.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const sb = createServiceClient();
  if (!sb) {
    return NextResponse.json({
      success: true,
      skipped: "service role not configured",
    });
  }

  const now = Date.now();
  const appUrl = process.env.APP_URL ?? new URL(request.url).origin;

  const { data: rows } = await sb.from("standing_tasks").select("*").eq("enabled", true);
  const due = (rows ?? []).map(taskFromRow).filter((t) => isDue(t, now));

  let ranTasks = 0;
  let newFindings = 0;

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
          await sb.from("findings").upsert(
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
          newFindings += fresh.length;
        }
      }

      await sb
        .from("standing_tasks")
        .update({ last_run_at: new Date(now).toISOString() })
        .eq("id", task.id);
      ranTasks += 1;
    } catch {
      // isolate per-task failures so one bad task doesn't stop the sweep
    }
  }

  return NextResponse.json({ success: true, ranTasks, newFindings });
}
