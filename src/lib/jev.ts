import type { SourceProvider } from "./sources-client";

/**
 * Jev — TypeSafe AI "System One" server-only client.
 *
 * Jev returns typed judgments (choice / score) + probabilities instead of text.
 * This module wraps the HTTP API (https://api.typesafe.ai/v1/systemone) so the
 * two structured decisions the app used to ask an LLM to emit as JSON —
 *   1. which source database a search angle should use (Choice)
 *   2. how relevant a candidate source is to a topic (Score)
 * — come back as real typed fields the caller can consume directly.
 *
 * Every public function throws `JevError` on any failure (network, auth, parse,
 * shape mismatch). Callers catch and degrade to the existing LLM-only path —
 * see `src/lib/ai-client.ts` → `proposeSearchAngles` / `triageSources`.
 *
 * Requires `TYPESAFE_API_KEY`. Server-only: never import this from a client
 * component (it reads a server secret).
 */

const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = process.env.TYPESAFE_JEV_MODEL ?? "jev-latest";
const JEV_TIMEOUT_MS = 30_000;

/** Provider domain descriptions — mirror the `angles` LLM prompt so Jev judges
 *  against the same definitions the fallback uses. */
const PROVIDER_CRITERIA: Record<SourceProvider, string> = {
  openalex:
    "Scholarly works across ALL fields (sciences, medicine, social science, humanities, literature). The DEFAULT for scholarship.",
  arxiv:
    "Preprints in physics, math, CS, statistics and other quantitative fields ONLY.",
  semanticscholar:
    "Computer-science / AI work where the citation graph matters.",
  wikipedia:
    "General background, definitions, and history ONLY — never for finding primary scholarship or literature.",
};

/** Ordered relevance levels for the Score primitive (0 = off-topic … 4 = central). */
const RELEVANCE_LEVELS: readonly string[] = [
  "Totally off-topic — shares no subject, method, or field with the research topic.",
  "Loosely related — adjacent field or shares a term, but not directly about the topic.",
  "Partially relevant — touches the topic but focuses on a different angle or population.",
  "Relevant — directly about the topic, though not a core or seminal source.",
  "Directly central — a core or seminal source squarely on the research topic.",
] as const;

const RELEVANCE_MAX_INDEX = RELEVANCE_LEVELS.length - 1; // 4

/** A single Jev question in the request body. */
interface JevChoiceQuestion {
  readonly type: "choice";
  readonly instructions: string;
  readonly criteria: Record<string, string>;
}

interface JevScoreQuestion {
  readonly type: "score";
  readonly instructions: string;
  readonly criteria: readonly string[];
}

interface JevNoulQuestion {
  readonly type: "noul";
  readonly instructions: string;
}

type JevQuestion = JevChoiceQuestion | JevScoreQuestion | JevNoulQuestion;

/** One answer in the Jev response. */
interface JevChoiceAnswer {
  readonly type: "choice";
  readonly choice: string;
  readonly probabilities: Record<string, number>;
  readonly confidence: number;
}

interface JevScoreAnswer {
  readonly type: "score";
  readonly score: number;
  readonly legend: Record<string, string>;
  readonly probabilities: Record<string, number>;
  readonly confidence: number;
}

interface JevNoulAnswer {
  readonly type: "noul";
  /** Probability of "yes", 0–1. */
  readonly noul: number;
}

type JevAnswer = JevChoiceAnswer | JevScoreAnswer | JevNoulAnswer;

interface JevResponse {
  readonly model: string;
  readonly usage: { input: number; output: number };
  readonly answers: Record<string, JevAnswer>;
}

/** Typed error so callers can distinguish a Jev failure from other exceptions. */
export class JevError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "JevError";
  }
}

/** True when a TYPESAFE_API_KEY is present (non-empty). Server-only. */
export function isJevConfigured(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY && process.env.TYPESAFE_API_KEY.trim());
}

/** Narrow an unknown JSON value to a string, or return undefined. */
function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Narrow an unknown JSON value to a plain object record. */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Call the Jev System One endpoint with a batch of questions over one state. */
async function callJev(
  state: unknown,
  questions: Record<string, JevQuestion>,
): Promise<JevResponse> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new JevError("TYPESAFE_API_KEY not configured.");
  }

  let res: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JEV_TIMEOUT_MS);
  try {
    res = await fetch(JEV_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ state, model: JEV_MODEL, questions }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    throw new JevError(
      aborted ? "Jev did not respond in time." : "Network error reaching Jev.",
      err,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new JevError(`Jev API returned ${res.status}. ${body.slice(0, 200)}`);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch (err: unknown) {
    throw new JevError("Could not parse Jev response JSON.", err);
  }

  const obj = asRecord(json);
  if (!obj || typeof obj.model !== "string") {
    throw new JevError("Jev response missing expected fields.");
  }
  const answersRec = asRecord(obj.answers);
  if (!answersRec) {
    throw new JevError("Jev response missing `answers`.");
  }

  // Narrow each answer into its typed variant; drop anything malformed.
  const answers: Record<string, JevAnswer> = {};
  for (const [id, raw] of Object.entries(answersRec)) {
    const a = asRecord(raw);
    if (!a || typeof a.type !== "string") continue;
    if (a.type === "choice") {
      const choice = asString(a.choice);
      if (choice !== undefined) {
        answers[id] = {
          type: "choice",
          choice,
          probabilities: asRecord(a.probabilities) as Record<string, number> ?? {},
          confidence: typeof a.confidence === "number" ? a.confidence : 0,
        };
      }
    } else if (a.type === "score") {
      if (typeof a.score === "number") {
        answers[id] = {
          type: "score",
          score: a.score,
          legend: asRecord(a.legend) as Record<string, string> ?? {},
          probabilities: asRecord(a.probabilities) as Record<string, number> ?? {},
          confidence: typeof a.confidence === "number" ? a.confidence : 0,
        };
      }
    } else if (a.type === "noul") {
      if (typeof a.noul === "number") {
        answers[id] = { type: "noul", noul: a.noul };
      }
    }
  }

  return {
    model: obj.model,
    usage: { input: 0, output: 0 },
    answers,
  };
}

/** Input angle for routing — only the query is needed; rationale is LLM text. */
export interface AngleRoutingInput {
  readonly query: string;
  readonly rationale?: string;
}

/** Shared source context, matching `src/lib/ai-client.ts` → `SourceContext`. */
export interface JevSourceContext {
  readonly title: string;
  readonly authors?: string;
  readonly year?: number;
  readonly abstract?: string;
}

/**
 * Route each search angle to the single best source database via one Jev
 * Choice question per angle. All questions share one `state` (the topic) and
 * run in parallel. Returns one `SourceProvider` per angle, in input order,
 * clamped to `allowedSources`. Throws `JevError` on any failure.
 */
export async function routeAnglesToSources(
  topic: string,
  angles: readonly AngleRoutingInput[],
  allowedSources: readonly SourceProvider[],
): Promise<SourceProvider[]> {
  if (angles.length === 0) return [];
  if (allowedSources.length === 0) {
    throw new JevError("No allowed sources provided for routing.");
  }
  const fallback: SourceProvider = allowedSources[0];

  const criteria: Record<string, string> = {};
  for (const p of allowedSources) {
    criteria[p] = PROVIDER_CRITERIA[p];
  }

  const questions: Record<string, JevQuestion> = {};
  angles.forEach((angle, i) => {
    questions[`angle_${i}`] = {
      type: "choice",
      instructions: `Given the research topic, which single database should run this search angle? Angle query: "${angle.query}".`,
      criteria,
    };
  });

  const res = await callJev({ topic }, questions);

  const pool = new Set(allowedSources);
  return angles.map((_, i) => {
    const answer = res.answers[`angle_${i}`];
    if (answer?.type !== "choice") return fallback;
    const picked = asString(answer.choice) ?? fallback;
    return pool.has(picked as SourceProvider) ? (picked as SourceProvider) : fallback;
  });
}

/**
 * Score each candidate source's relevance to the topic via one Jev Score
 * question per source. Returns one 0–100 integer per source, in input order,
 * or `null` where Jev did not return a usable answer for that source. `null`
 * (not 0) signals "no Jev judgment" so callers can keep the LLM's score
 * instead of silently rewriting it to 0 on a partial failure (L06). Jev
 * returns a probability-weighted mean over level numbers 0–4; we map that
 * onto 0–100. Throws `JevError` on any failure.
 */
export async function scoreSourcesRelevance(
  topic: string,
  sources: readonly JevSourceContext[],
): Promise<(number | null)[]> {
  if (sources.length === 0) return [];

  const questions: Record<string, JevQuestion> = {};
  sources.forEach((src, i) => {
    questions[`source_${i}`] = {
      type: "score",
      instructions: `How relevant is this source to the research topic "${topic}"? Source title: "${src.title}".${src.abstract ? ` Abstract: "${src.abstract.slice(0, 400)}".` : ""}`,
      criteria: RELEVANCE_LEVELS,
    };
  });

  const res = await callJev({ topic }, questions);

  return sources.map((_, i) => {
    const answer = res.answers[`source_${i}`];
    if (answer?.type !== "score") return null;
    const clamped = Math.max(0, Math.min(RELEVANCE_MAX_INDEX, answer.score));
    return Math.round((clamped / RELEVANCE_MAX_INDEX) * 100);
  });
}

/** An audit finding to judge — only `claim` and `source` (1-based) are used. */
export interface ClaimSupportInput {
  readonly claim: string;
  /** 1-based index into `sources`, or null when no source is cited. */
  readonly source: number | null;
}

/**
 * E0.2 — Judge whether each cited source actually supports its claim, via one
 * Jev Noul question per finding-with-a-source. Findings with `source: null`
 * get `null` (nothing to judge). Returns a probability (0–1) per finding in
 * input order, or `null` where there was no source to judge. Throws `JevError`
 * on any failure.
 */
export async function judgeClaimSupport(
  draft: string,
  findings: readonly ClaimSupportInput[],
  sources: readonly JevSourceContext[],
): Promise<(number | null)[]> {
  if (findings.length === 0) return [];

  const questions: Record<string, JevQuestion> = {};
  findings.forEach((f, i) => {
    if (f.source === null || f.source < 1) return; // skip unsupported — nothing to judge
    const src = sources[f.source - 1];
    if (!src) return;
    questions[`claim_${i}`] = {
      type: "noul",
      instructions: `Does the cited source actually contain and support this claim? Claim: "${f.claim.slice(0, 300)}". Source [${f.source}] title: "${src.title}".${src.abstract ? ` Source abstract: "${src.abstract.slice(0, 600)}".` : ""}`,
    };
  });

  const res = await callJev({ draft }, questions);

  return findings.map((f, i) => {
    if (f.source === null || f.source < 1) return null;
    const answer = res.answers[`claim_${i}`];
    if (answer?.type !== "noul") return null;
    return Math.max(0, Math.min(1, answer.noul));
  });
}

/**
 * E0.1 — Judge whether an OpenAlex candidate record is the same work as the
 * cited reference, via a Jev Noul question. Returns a probability (0–1) that
 * they match. Throws `JevError` on any failure.
 */
export async function judgeReferenceMatch(
  cited: { title: string; authors?: string; year?: number },
  candidate: { title: string; authors?: string; year?: number },
): Promise<number> {
  const res = await callJev(
    {
      cited: { title: cited.title, authors: cited.authors ?? "", year: cited.year ?? null },
      candidate: {
        title: candidate.title,
        authors: candidate.authors ?? "",
        year: candidate.year ?? null,
      },
    },
    {
      match: {
        type: "noul",
        instructions:
          "Is the `candidate` OpenAlex record the SAME scholarly work as the `cited` reference? Answer yes only if they are the same publication (same title or near-identical title, and matching authors/venue), not merely a related or similar work.",
      },
    },
  );
  const answer = res.answers.match;
  if (answer?.type !== "noul") {
    throw new JevError("Jev returned no match judgment.");
  }
  return Math.max(0, Math.min(1, answer.noul));
}