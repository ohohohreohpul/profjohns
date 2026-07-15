/**
 * Standing tasks + findings (VISION Phase 4 — "work while you sleep").
 *
 * A StandingTask is a saved search an agent re-runs on a schedule; Findings
 * are its deduped results. This module holds the shared types + the PURE
 * helpers (dedup, scheduling) used by both the on-demand ("Run now") client
 * path and the server-side cron. Dependency-free so it's unit-testable.
 */
import type { PaperSource } from "@/lib/mock";
import type { SourceProvider } from "@/lib/sources-client";

export type Schedule = "manual" | "daily" | "weekly";
export type FindingStatus = "new" | "kept" | "dismissed";

export interface StandingTask {
  id: string;
  projectId?: string;
  topic: string;
  sources: SourceProvider[];
  agentId?: string;
  schedule: Schedule;
  enabled: boolean;
  lastRunAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Finding {
  id: string;
  taskId: string;
  sourceId: string;
  title: string;
  authors?: string;
  year?: number;
  url?: string;
  score?: number;
  why?: string;
  status: FindingStatus;
  source: PaperSource;
  createdAt: number;
}

/** Normalize a title for cross-index dedup (the same paper appears in OpenAlex,
 *  arXiv, S2 with different ids). */
export function titleKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Keep only candidates not already known — by id OR normalized title. Pure;
 *  does not mutate its inputs. */
export function newCandidates(
  candidates: PaperSource[],
  knownIds: Iterable<string>,
  knownTitleKeys: Iterable<string> = [],
): PaperSource[] {
  const ids = new Set(knownIds);
  const titles = new Set(knownTitleKeys);
  const out: PaperSource[] = [];
  for (const p of candidates) {
    if (!p?.id || !p.title) continue;
    const tk = titleKey(p.title);
    if (ids.has(p.id) || titles.has(tk)) continue;
    ids.add(p.id);
    titles.add(tk);
    out.push(p);
  }
  return out;
}

const DAY_MS = 86_400_000;

/** Is a task due to run at `now`? Manual tasks are never auto-due; daily/weekly
 *  compare against lastRunAt. A never-run enabled task is always due. */
export function isDue(task: StandingTask, now: number): boolean {
  if (!task.enabled || task.schedule === "manual") return false;
  if (task.lastRunAt == null) return true;
  const interval = task.schedule === "weekly" ? 7 * DAY_MS : DAY_MS;
  return now - task.lastRunAt >= interval;
}
