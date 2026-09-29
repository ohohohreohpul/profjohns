import type { PaperSource } from "./mock";
import type { SourceProvider } from "./sources-client";

const ALLOWED_SOURCES: SourceProvider[] = ["openalex", "arxiv", "semanticscholar", "wikipedia"];

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  configured: boolean;
}

interface AiAnswer {
  answer: string;
}

interface SourceContext {
  title: string;
  authors?: string;
  year?: number;
  abstract?: string;
}

interface AiRequestBody {
  mode:
    | "summarize"
    | "ask"
    | "write"
    | "batch"
    | "edit"
    | "diagram"
    | "explore"
    | "angles"
    | "triage"
    | "gaps"
    | "refine"
    | "libchat"
    | "libcat"
    | "audit"
    | "dna"
    | "synth"
    | "vision"
    | "complete"
    | "titles"
    | "outline"
    | "section";
  text?: string;
  title?: string;
  question?: string;
  instruction?: string;
  sources?: SourceContext[];
  draft?: string;
  /** When present, the `angles` mode routes each angle to one of these. */
  allowedSources?: SourceProvider[];
  /** Free-text research directions, used by the `refine` mode. */
  directions?: string[];
  /** Lily's voice profile — conditions the `write` mode. */
  style?: string;
  /** A bound Agent's system prompt — prepended to the mode instructions. */
  persona?: string;
  /** Image (data-URL or https) for `vision` mode. */
  image?: string;
  /** L18 — catalog model id selected in the node's picker. When present the
   *  route resolves it to a real OpenRouter model id and runs THAT model
   *  instead of the mode-based default, so the picker is truthful. */
  modelId?: string;
}

/** A proposed search angle — the AI also routes it to the best database. */
export interface SearchAngle {
  query: string;
  rationale: string;
  source: SourceProvider;
}

/** AI relevance verdict for one candidate source (n = 1-based position). */
export interface SourceVerdict {
  n: number;
  score: number;
  why: string;
  cluster: string;
}

/** A coverage gap in the gathered sources, with a search to fill it. */
export interface CoverageGap {
  gap: string;
  query: string;
}

/** A theme + search expansions produced by the opt-in "Improve my feed" pass. */
export interface RefineTheme {
  theme: string;
  queries: string[];
}

/** Client-side fetch with an AbortController timeout. Prevents UI hangs when a
 *  server route or upstream provider stalls. On timeout the fetch aborts and
 *  throws a DOMException(AbortError) the caller can translate. */
async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Human-friendly message for a timed-out fetch. */
function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

function toContext(sources: PaperSource[]): SourceContext[] {
  return sources.map((s) => ({
    title: s.title,
    authors: s.authors,
    year: s.year,
    abstract: s.abstract,
  }));
}

/** Envelope shared by the Jev boundary (`/api/jev`) and the AI boundary. */
interface JevResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  configured: boolean;
}

/** Refine the `source` field of each angle with a Jev Choice judgment.
 *  Non-throwing: on any failure (unconfigured, network, shape mismatch) the
 *  caller's LLM-derived angles are returned unchanged. */
async function refineAngleSources(
  angles: SearchAngle[],
  topic: string,
  allowedSources: readonly SourceProvider[],
): Promise<SearchAngle[]> {
  if (angles.length === 0) return angles;
  try {
    const res = await fetchWithTimeout(
      "/api/jev",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "route-angles",
          topic,
          angles: angles.map((a) => ({ query: a.query, rationale: a.rationale })),
          allowedSources: [...allowedSources],
        }),
      },
      JEV_TIMEOUT_MS,
    );
    const json = (await res.json()) as JevResponse<SourceProvider[]>;
    const providers = json.data;
    if (!json.success || !Array.isArray(providers) || providers.length !== angles.length) {
      return angles;
    }
    const pool = allowedSources;
    const fallback: SourceProvider = pool[0] ?? "openalex";
    return angles.map((a, i) => ({
      ...a,
      source: pool.includes(providers[i]) ? providers[i] : fallback,
    }));
  } catch {
    return angles;
  }
}

/** Refine the `score` field of each verdict with a Jev Score judgment.
 *  Non-throwing: on any failure the caller's LLM-derived verdicts are returned
 *  unchanged. Verdicts are matched by their `n` (1-based) field. */
async function refineVerdictScores(
  verdicts: SourceVerdict[],
  topic: string,
  sources: PaperSource[],
): Promise<SourceVerdict[]> {
  if (verdicts.length === 0) return verdicts;
  try {
    const res = await fetchWithTimeout(
      "/api/jev",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "score-sources",
          topic,
          sources: toContext(sources),
        }),
      },
      JEV_TIMEOUT_MS,
    );
    const json = (await res.json()) as JevResponse<number[]>;
    const scores = json.data;
    if (!json.success || !Array.isArray(scores)) {
      return verdicts;
    }
    // scores is 0-based by source order; verdict.n is 1-based.
    return verdicts.map((v) => {
      const idx = v.n - 1;
      const jevScore = scores[idx];
      return typeof jevScore === "number" && jevScore >= 0
        ? { ...v, score: Math.max(0, Math.min(100, Math.round(jevScore))) }
        : v;
    });
  } catch {
    return verdicts;
  }
}

/** Parse a JSON array out of a model response, tolerating fences/preamble. */
function parseJsonArray<T>(raw: string): T[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) {
    throw new Error("Expected a JSON array from the assistant.");
  }
  const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Expected a JSON array from the assistant.");
  }
  return parsed as T[];
}

/** Parse a JSON object out of a model response, tolerating fences/preamble. */
function parseJsonObject<T>(raw: string): T {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Expected a JSON object from the assistant.");
  }
  return JSON.parse(raw.slice(start, end + 1)) as T;
}

function numList(v: unknown): number[] {
  return Array.isArray(v) ? v.filter((n): n is number => typeof n === "number") : [];
}

const AI_TIMEOUT_MS = 90_000;
const AI_FAST_TIMEOUT_MS = 20_000;
const JEV_TIMEOUT_MS = 30_000;

async function callAi(
  body: AiRequestBody,
  timeoutMs: number = AI_TIMEOUT_MS,
): Promise<string> {
  let res: Response;
  try {
    res = await fetchWithTimeout(
      "/api/ai",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      timeoutMs,
    );
  } catch (err: unknown) {
    if (isAbortError(err)) {
      throw new Error("The request timed out. Please try again.");
    }
    throw err;
  }
  const json = (await res.json()) as ApiResponse<AiAnswer>;
  if (!json.success || !json.data) {
    throw new Error(json.error ?? "The assistant could not respond.");
  }
  return json.data.answer;
}

export function summarizePaper(
  text: string,
  title?: string,
  modelId?: string,
): Promise<string> {
  return callAi({ mode: "summarize", text, title, modelId });
}

export function askPaper(
  text: string,
  question: string,
  title?: string,
  modelId?: string,
): Promise<string> {
  return callAi({ mode: "ask", text, question, title, modelId });
}

export function writeFromSources(
  instruction: string,
  sources: PaperSource[],
  draft?: string,
  style?: string,
  persona?: string,
  modelId?: string,
): Promise<string> {
  const compact: SourceContext[] = sources.map((s) => ({
    title: s.title,
    authors: s.authors,
    year: s.year,
    abstract: s.abstract,
  }));
  return callAi({ mode: "write", instruction, sources: compact, draft, style, persona, modelId });
}

/** Lily — derive a reusable writing-voice profile from the author's sample. */
export function deriveStyleProfile(sample: string, modelId?: string): Promise<string> {
  return callAi({ mode: "dna", text: sample, modelId });
}

/** Structured synthesis over a source set — `sources` are 1-based indices into
 *  the connected source list, in the order passed to synthesizeSources. */
export interface SynthClaim {
  claim: string;
  sources: number[];
  evidence: string;
}
export interface SynthContradiction {
  claim: string;
  sources: number[];
  note: string;
}
export interface SynthTheme {
  theme: string;
  sources: number[];
}
export interface Synthesis {
  claims: SynthClaim[];
  contradictions: SynthContradiction[];
  themes: SynthTheme[];
}

/** Synthesize connected sources into structured claims, contradictions, themes. */
export async function synthesizeSources(
  sources: PaperSource[],
  persona?: string,
  modelId?: string,
): Promise<Synthesis> {
  const raw = await callAi({ mode: "synth", sources: toContext(sources), persona, modelId });
  const obj = parseJsonObject<Partial<Synthesis>>(raw);
  const claims = Array.isArray(obj.claims) ? obj.claims : [];
  const contradictions = Array.isArray(obj.contradictions) ? obj.contradictions : [];
  const themes = Array.isArray(obj.themes) ? obj.themes : [];
  return {
    claims: claims
      .map((c) => ({
        claim: String(c?.claim ?? "").trim(),
        sources: numList(c?.sources),
        evidence: String(c?.evidence ?? "").trim(),
      }))
      .filter((c) => c.claim),
    contradictions: contradictions
      .map((c) => ({
        claim: String(c?.claim ?? "").trim(),
        sources: numList(c?.sources),
        note: String(c?.note ?? "").trim(),
      }))
      .filter((c) => c.claim),
    themes: themes
      .map((t) => ({
        theme: String(t?.theme ?? "").trim(),
        sources: numList(t?.sources),
      }))
      .filter((t) => t.theme),
  };
}

export function batchSummarizeSources(
  sources: PaperSource[],
  modelId?: string,
): Promise<string> {
  const compact: SourceContext[] = sources.map((s) => ({
    title: s.title,
    authors: s.authors,
    year: s.year,
    abstract: s.abstract,
  }));
  return callAi({ mode: "batch", sources: compact, modelId });
}

/**
 * Edit existing text. When `sources` are connected the text should be sent
 * `[n]`-indexed (see `contentToIndexedProse`) and the route preserves citation
 * markers so traceability survives the edit — the trust moat holds. Without
 * sources, edit operates on plain text.
 */
export function editText(
  text: string,
  instruction: string,
  persona?: string,
  sources?: PaperSource[],
  style?: string,
  modelId?: string,
): Promise<string> {
  const compact: SourceContext[] | undefined = sources
    ? sources.map((s) => ({
        title: s.title,
        authors: s.authors,
        year: s.year,
        abstract: s.abstract,
      }))
    : undefined;
  return callAi({ mode: "edit", text, instruction, persona, sources: compact, style, modelId });
}

export function generateDiagram(text: string, modelId?: string): Promise<string> {
  return callAi({ mode: "diagram", text, modelId });
}

/** Inline autocomplete — a short continuation of the text up to the cursor.
 *  Cheap + fast; used for ghost-text suggestions while typing. */
export async function completeText(
  precedingText: string,
  modelId?: string,
): Promise<string> {
  const raw = await callAi({ mode: "complete", text: precedingText, modelId }, AI_FAST_TIMEOUT_MS);
  // Strip stray wrapping quotes / leading whitespace the model may add.
  return raw.replace(/^\s+/, "").replace(/^["'“]|["'”]$/g, "").slice(0, 200);
}

/** Compose — propose a paper outline from the connected sources (+ synthesis
 *  claims when available). Returns section titles. */
export async function proposeOutline(
  sources: PaperSource[],
  claimsText?: string,
  persona?: string,
  modelId?: string,
): Promise<string[]> {
  const raw = await callAi({
    mode: "outline",
    sources: toContext(sources),
    text: claimsText,
    persona,
    modelId,
  });
  return parseJsonArray<string>(raw)
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    .map((t) => t.trim())
    .slice(0, 8);
}

/** Compose — draft ONE section from the selected sources. The result cites
 *  with [n] markers that index into `sources` (1-based); convert via
 *  lib/compose.sectionToContent so citations become real marks. */
export function writeSection(args: {
  sectionTitle: string;
  outline?: string[];
  sources: PaperSource[];
  claimsText?: string;
  style?: string;
  persona?: string;
  modelId?: string;
}): Promise<string> {
  return callAi({
    mode: "section",
    question: args.sectionTitle,
    directions: args.outline,
    sources: toContext(args.sources),
    text: args.claimsText,
    style: args.style,
    persona: args.persona,
    modelId: args.modelId,
  });
}

/** Suggest 5 paper-title options from the current draft. */
export async function suggestTitles(
  draft: string,
  modelId?: string,
): Promise<string[]> {
  const raw = await callAi({ mode: "titles", draft, modelId });
  return parseJsonArray<string>(raw)
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    .map((t) => t.trim().replace(/^["'“]|["'”]$/g, ""))
    .slice(0, 5);
}

/** Vision — describe/analyze a figure with a multimodal model.
 *  `caption` (optional) gives the model any existing caption/alt as context. */
export function describeImage(
  image: string,
  caption?: string,
  persona?: string,
  modelId?: string,
): Promise<string> {
  return callAi({ mode: "vision", image, text: caption, persona, modelId });
}

export function exploreQuery(
  question: string,
  sources: PaperSource[],
  modelId?: string,
): Promise<string> {
  return callAi({ mode: "explore", question, sources: toContext(sources).slice(0, 8), modelId });
}

/** Propose distinct search angles for comprehensively covering a topic.
 *  When `allowedSources` is provided, the AI is asked to route each angle
 *  to one of those providers and the result is clamped to that set. */
export async function proposeSearchAngles(
  topic: string,
  allowedSources?: readonly SourceProvider[],
  persona?: string,
  modelId?: string,
): Promise<SearchAngle[]> {
  const res = await callAi({
    mode: "angles",
    text: topic,
    allowedSources: allowedSources ? [...allowedSources] : undefined,
    persona,
    modelId,
  });
  const pool = allowedSources ?? ALLOWED_SOURCES;
  const fallback: SourceProvider = pool[0] ?? "openalex";
  const llmAngles = parseJsonArray<SearchAngle>(res)
    .filter((a) => a && typeof a.query === "string" && a.query.trim().length > 0)
    .map((a) => ({
      query: a.query.trim(),
      rationale: a.rationale ?? "",
      source: pool.includes(a.source) ? a.source : fallback,
    }));
  // Jev refines the per-angle database choice when configured; LLM keeps the
  // query + rationale. Falls back silently to `llmAngles` on any failure.
  return refineAngleSources(llmAngles, topic, pool);
}

/** Score & cluster candidate sources by relevance to the topic. */
export async function triageSources(
  topic: string,
  sources: PaperSource[],
  persona?: string,
  modelId?: string,
): Promise<SourceVerdict[]> {
  const raw = await callAi({
    mode: "triage",
    question: topic,
    sources: toContext(sources),
    persona,
    modelId,
  });
  const llmVerdicts = parseJsonArray<SourceVerdict>(raw).filter(
    (v) => v && typeof v.n === "number",
  );
  // Jev refines the relevance score when configured; LLM keeps the why/cluster
  // text. Falls back silently to `llmVerdicts` on any failure.
  return refineVerdictScores(llmVerdicts, topic, sources);
}

/** Identify coverage gaps in the gathered sources. */
export async function findGaps(
  topic: string,
  sources: PaperSource[],
  persona?: string,
  modelId?: string,
): Promise<CoverageGap[]> {
  const raw = await callAi({
    mode: "gaps",
    question: topic,
    sources: toContext(sources),
    persona,
    modelId,
  });
  return parseJsonArray<CoverageGap>(raw).filter(
    (g) => g && typeof g.query === "string" && g.query.trim().length > 0,
  );
}

/** Opt-in "Improve my feed" — one AI pass that clusters the corpus into
 *  themes + query expansions. Cached + invoked only on demand (A4). */
export async function refineFeed(
  sources: PaperSource[],
  directions: string[],
  modelId?: string,
): Promise<RefineTheme[]> {
  const raw = await callAi({
    mode: "refine",
    sources: toContext(sources).slice(0, 12),
    directions,
    modelId,
  });
  return parseJsonArray<RefineTheme>(raw)
    .filter((t) => t && typeof t.theme === "string")
    .map((t) => ({
      theme: t.theme.trim(),
      queries: Array.isArray(t.queries)
        ? t.queries.filter((q) => typeof q === "string" && q.trim()).map((q) => q.trim())
        : [],
    }))
    .filter((t) => t.queries.length > 0);
}

/** A category produced by the library auto-categorize pass. */
export interface LibraryCategory {
  category: string;
  keys: string[];
}

/** Chat over the account library — grounded answer from the item catalog. */
export function askLibrary(
  catalog: string,
  question: string,
  modelId?: string,
): Promise<string> {
  return callAi({ mode: "libchat", text: catalog, question, modelId });
}

/** Auto-categorize the account library into themed groups of item keys. */
export async function categorizeLibrary(
  catalog: string,
  modelId?: string,
): Promise<LibraryCategory[]> {
  const raw = await callAi({ mode: "libcat", text: catalog, modelId });
  return parseJsonArray<LibraryCategory>(raw)
    .filter((c) => c && typeof c.category === "string" && Array.isArray(c.keys))
    .map((c) => ({
      category: c.category.trim(),
      keys: c.keys.filter((k) => typeof k === "string" && k.trim()),
    }))
    .filter((c) => c.category && c.keys.length > 0);
}

/** A citation-audit verdict for one claim (Johns). `source` is the 1-based
 *  index into the audited source set, or null when unsupported. `probability`
 *  is Jev's support probability when the Jev refinement ran. */
export interface AuditFinding {
  claim: string;
  status: "supported" | "weak" | "unsupported";
  source: number | null;
  note: string;
  probability?: number;
}

/** A reference existence-verification verdict (E0.1). `index` is 0-based into
 *  the audited source list. */
export interface ReferenceVerification {
  index: number;
  status: "verified" | "metadata-mismatch" | "not-found";
  probability?: number;
  candidateTitle?: string;
  /** L04 — link to the OpenAlex candidate, so a verdict is actionable. */
  candidateUrl?: string;
  note: string;
}

const AUDIT_STATUSES = new Set(["supported", "weak", "unsupported"]);
const AUDIT_SUPPORT_THRESHOLD = 0.66;
const AUDIT_WEAK_THRESHOLD = 0.34;

/** Map a Jev support probability to a support status. */
function probabilityToStatus(p: number): AuditFinding["status"] {
  if (p >= AUDIT_SUPPORT_THRESHOLD) return "supported";
  if (p >= AUDIT_WEAK_THRESHOLD) return "weak";
  return "unsupported";
}

/** Refine audit findings with a Jev Noul support judgment per cited claim.
 *  Non-throwing: on any failure the LLM-derived findings are returned unchanged. */
async function refineAuditFindings(
  draft: string,
  findings: AuditFinding[],
  sources: PaperSource[],
): Promise<AuditFinding[]> {
  if (findings.length === 0) return findings;
  try {
    const res = await fetchWithTimeout(
      "/api/jev",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "audit-claims",
          draft,
          findings: findings.map((f) => ({ claim: f.claim, source: f.source })),
          sources: toContext(sources),
        }),
      },
      JEV_TIMEOUT_MS,
    );
    const json = (await res.json()) as JevResponse<(number | null)[]>;
    const probabilities = json.data;
    if (!json.success || !Array.isArray(probabilities) || probabilities.length !== findings.length) {
      return findings;
    }
    return findings.map((f, i) => {
      const p = probabilities[i];
      if (typeof p !== "number" || p === null) return f;
      return { ...f, status: probabilityToStatus(p), probability: p };
    });
  } catch {
    return findings;
  }
}

/** Johns — audit a draft's claims against the connected sources. */
export async function auditDraft(
  draft: string,
  sources: PaperSource[],
  persona?: string,
  modelId?: string,
): Promise<AuditFinding[]> {
  const raw = await callAi({
    mode: "audit",
    draft,
    sources: toContext(sources),
    persona,
    modelId,
  });
  const llmFindings = parseJsonArray<AuditFinding>(raw)
    .filter((f) => f && typeof f.claim === "string" && AUDIT_STATUSES.has(f.status))
    .map((f) => ({
      claim: f.claim.trim(),
      status: f.status,
      source:
        typeof f.source === "number" && f.source >= 1 ? Math.floor(f.source) : null,
      note: typeof f.note === "string" ? f.note.trim() : "",
    }));
  // Jev refines the per-claim support status when configured; LLM keeps the
  // claim text + note. Falls back silently to `llmFindings` on any failure.
  return refineAuditFindings(draft, llmFindings, sources);
}

/** E0.1 — verify each connected reference exists in OpenAlex. Non-throwing:
 *  returns `[]` on any failure so the UI shows "could not check". */
export async function verifyReferences(
  sources: PaperSource[],
): Promise<ReferenceVerification[]> {
  if (sources.length === 0) return [];
  try {
    const res = await fetchWithTimeout(
      "/api/jev",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "verify-references", sources }),
      },
      JEV_TIMEOUT_MS,
    );
    const json = (await res.json()) as JevResponse<ReferenceVerification[]>;
    if (!json.success || !Array.isArray(json.data)) return [];
    return json.data;
  } catch {
    return [];
  }
}