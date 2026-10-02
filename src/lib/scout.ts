/**
 * The Scout pipeline — find and screen papers for a research question.
 * Shared by the canvas Sources node and the v2 board's Sources wall.
 *
 *   plan angles (AI) -> search each angle on its routed index
 *   -> pool round-robin across angles -> Jev pre-rank -> AI screen (why +
 *   cluster) -> keep policy (strong matches, else the closest few).
 */
import { searchProvider, type SourceProvider } from "@/lib/sources-client";
import { proposeSearchAngles, triageSources, rankSourcesByRelevance } from "@/lib/ai-client";
import { decideKeeps, type KeepDecision } from "@/lib/keep-policy";
import { interleave, rankByScore } from "@/lib/source-pool";
import type { PaperSource } from "@/lib/mock";

export const RESULTS_PER_ANGLE = 8;
/** Papers sent to the full AI screen (writes the why + cluster per paper). */
export const TRIAGE_BATCH = 12;
/** Papers pre-ranked by Jev before screening — must stay <= the /api/jev cap. */
export const PRE_RANK_POOL = 40;
const BETWEEN_ANGLES_MS = 350;

export interface ScoutAngle {
  readonly query: string;
  readonly rationale: string;
  readonly source: SourceProvider;
}

export interface ScreenedPaper extends PaperSource {
  readonly score?: number;
  readonly why?: string;
  readonly cluster: string;
  readonly kept: boolean;
}

export interface ScoutOptions {
  readonly allowedSources?: SourceProvider[];
  readonly persona?: string;
  readonly modelId?: string;
}

export class ScoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScoutError";
  }
}

/** The AI route answers "not configured" when no model key is set. */
export function isNotConfigured(err: unknown): boolean {
  return err instanceof Error && /not configured/i.test(err.message);
}

/** Honest notice when the kept papers are only the closest available. */
export function weakMatchMessage(decision: KeepDecision): string | null {
  if (!decision.isFallback) return null;
  const n = decision.kept.filter(Boolean).length;
  return `No strong matches for this question, so the ${n} closest paper${n === 1 ? " was" : "s were"} kept. Narrow or edit the angles for better results.`;
}

/** Step 1: plan search angles. Falls back to a direct search without AI. */
export async function planScoutAngles(
  topic: string,
  opts: ScoutOptions,
): Promise<{ angles: ScoutAngle[]; aiOff: boolean }> {
  try {
    const angles = await proposeSearchAngles(topic, opts.allowedSources, opts.persona, opts.modelId);
    return { angles, aiOff: false };
  } catch (err: unknown) {
    const source = opts.allowedSources?.[0] ?? "openalex";
    return { angles: [{ query: topic, rationale: "Direct search", source }], aiOff: isNotConfigured(err) };
  }
}

/** Broad indexes to retry on, in order, when an angle's own index fails. */
const FALLBACK_ORDER: readonly SourceProvider[] = ["openalex", "semanticscholar", "arxiv"];

/**
 * Where to retry when `failed` errors: the first index in FALLBACK_ORDER the
 * board allows (all, when unrestricted) that isn't already known to be down.
 */
export function fallbackProvider(
  failed: SourceProvider,
  down: ReadonlySet<SourceProvider>,
  allowed?: readonly SourceProvider[],
): SourceProvider | null {
  return FALLBACK_ORDER.find((p) => p !== failed && !down.has(p) && (!allowed || allowed.includes(p))) ?? null;
}

const titleKey = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** One angle's search; on failure, the same query on a working index. */
async function searchWithFallback(
  source: SourceProvider,
  query: string,
  down: Set<SourceProvider>,
  allowed?: readonly SourceProvider[],
): Promise<PaperSource[]> {
  let provider: SourceProvider | null = down.has(source) ? fallbackProvider(source, down, allowed) : source;
  while (provider) {
    try {
      return await searchProvider(provider, query);
    } catch (err: unknown) {
      down.add(provider);
      console.error(`[scout] ${provider} search failed; trying another index`, err);
      provider = fallbackProvider(provider, down, allowed);
    }
  }
  throw new ScoutError("Every search index failed for this angle.");
}

/** Step 2: search the angles, then rank, screen and decide what to keep. */
export async function searchAndScreen(
  topic: string,
  angles: readonly Pick<ScoutAngle, "query" | "source">[],
  opts: ScoutOptions & {
    /** Papers already on the board (by id and title) are skipped. */
    readonly known?: readonly Pick<PaperSource, "id" | "title">[];
    readonly onProgress?: (label: string) => void;
  },
): Promise<{ screened: ScreenedPaper[]; weakMatchNote: string | null; aiOff: boolean }> {
  const knownIds = new Set((opts.known ?? []).map((k) => k.id));
  const knownTitles = new Set((opts.known ?? []).map((k) => titleKey(k.title)));
  const perAngle: PaperSource[][] = [];
  let anyOk = false;
  // Indexes that failed during this search (rate limited, down): skipped after.
  const down = new Set<SourceProvider>();

  for (let i = 0; i < angles.length; i++) {
    opts.onProgress?.(angles.length > 1 ? `Searching angle ${i + 1} of ${angles.length}…` : "Searching…");
    if (i > 0) await new Promise((r) => setTimeout(r, BETWEEN_ANGLES_MS)); // be polite to public APIs
    const mine: PaperSource[] = [];
    try {
      const found = await searchWithFallback(angles[i].source, angles[i].query, down, opts.allowedSources);
      anyOk = true;
      for (const p of found.slice(0, RESULTS_PER_ANGLE)) {
        const tk = titleKey(p.title);
        if (knownIds.has(p.id) || knownTitles.has(tk)) continue;
        knownIds.add(p.id);
        knownTitles.add(tk);
        mine.push(p);
      }
    } catch {
      // one angle failing shouldn't abort the rest
    }
    perAngle.push(mine);
  }
  if (!anyOk) throw new ScoutError("Search failed. Please try again.");

  const pool = interleave(perAngle).slice(0, PRE_RANK_POOL);
  if (pool.length === 0) throw new ScoutError("No new sources found for those angles.");

  opts.onProgress?.(`Ranking ${pool.length} papers by relevance…`);
  const preScores = await rankSourcesByRelevance(topic, pool);
  const top = rankByScore(pool, preScores ?? []).slice(0, TRIAGE_BATCH);
  const batch = top.map((r) => r.item);
  const knownScores = preScores ? top.map((r) => r.score) : undefined;

  opts.onProgress?.("Screening for relevance…");
  try {
    const verdicts = await triageSources(topic, batch, opts.persona, opts.modelId, knownScores);
    const byN = new Map(verdicts.map((v) => [v.n, v]));
    const decision = decideKeeps(batch.map((_, i) => byN.get(i + 1)?.score));
    return {
      screened: batch.map((p, i) => {
        const v = byN.get(i + 1);
        return { ...p, score: v?.score, why: v?.why, cluster: v?.cluster ?? "Results", kept: decision.kept[i] };
      }),
      weakMatchNote: weakMatchMessage(decision),
      aiOff: false,
    };
  } catch (err: unknown) {
    const aiOff = isNotConfigured(err);
    // The writing model failed, but Jev's relevance still decides keeps when
    // it ran; only with no scores at all is everything kept.
    if (knownScores) {
      const decision = decideKeeps(knownScores.map((x) => x ?? undefined));
      return {
        screened: batch.map((p, i) => ({ ...p, score: knownScores[i] ?? undefined, cluster: "Results", kept: decision.kept[i] })),
        weakMatchNote: weakMatchMessage(decision),
        aiOff,
      };
    }
    return { screened: batch.map((p) => ({ ...p, cluster: "Results", kept: true })), weakMatchNote: null, aiOff };
  }
}
