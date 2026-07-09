"use client";

/**
 * On-demand ("Run now") execution of a standing task, in the browser — reuses
 * the exact Scout pipeline the Sources node uses (plan angles → search →
 * dedup → AI triage). The server-side cron runs the same shape against the
 * app's own API routes; this client path makes a task usable + testable
 * immediately, without waiting for the schedule.
 */
import { searchProvider } from "@/lib/sources-client";
import { proposeSearchAngles, triageSources } from "@/lib/ai-client";
import { newCandidates, type StandingTask } from "@/lib/watch";
import type { PaperSource } from "@/lib/mock";

const MAX_ANGLES = 3;
const PER_ANGLE = 6;
const TRIAGE_BATCH = 12;
const KEEP_THRESHOLD = 70;

export interface RunResult {
  source: PaperSource;
  score?: number;
  why?: string;
}

export async function runTaskClient(
  task: StandingTask,
  opts: { persona?: string; knownIds?: string[] } = {},
): Promise<RunResult[]> {
  const providers = task.sources.length ? task.sources : (["openalex"] as const);

  // Plan angles (degrade to a direct search if the AI is unavailable).
  let angles: { query: string; source: (typeof providers)[number] }[];
  try {
    const proposed = await proposeSearchAngles(task.topic, providers, opts.persona);
    angles = proposed.map((a) => ({ query: a.query, source: a.source }));
  } catch {
    angles = [{ query: task.topic, source: providers[0] }];
  }

  const found: PaperSource[] = [];
  for (const a of angles.slice(0, MAX_ANGLES)) {
    try {
      const results = await searchProvider(a.source, a.query);
      found.push(...results.slice(0, PER_ANGLE));
    } catch {
      // one angle failing shouldn't abort the run
    }
  }

  const fresh = newCandidates(found, opts.knownIds ?? []).slice(0, TRIAGE_BATCH);
  if (fresh.length === 0) return [];

  // Screen for relevance. If triage fails, keep the fresh set unscored.
  let verdicts;
  try {
    verdicts = await triageSources(task.topic, fresh, opts.persona);
  } catch {
    return fresh.map((source) => ({ source }));
  }
  const byN = new Map(verdicts.map((v) => [v.n, v]));
  return fresh
    .map((source, i) => {
      const v = byN.get(i + 1);
      return { source, score: v?.score, why: v?.why };
    })
    .filter((r) => r.score == null || r.score >= KEEP_THRESHOLD);
}
