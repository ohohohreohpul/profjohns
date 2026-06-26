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
    | "audit";
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

function toContext(sources: PaperSource[]): SourceContext[] {
  return sources.map((s) => ({
    title: s.title,
    authors: s.authors,
    year: s.year,
    abstract: s.abstract,
  }));
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

async function callAi(body: AiRequestBody): Promise<string> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<AiAnswer>;
  if (!json.success || !json.data) {
    throw new Error(json.error ?? "The assistant could not respond.");
  }
  return json.data.answer;
}

export function summarizePaper(text: string, title?: string): Promise<string> {
  return callAi({ mode: "summarize", text, title });
}

export function askPaper(
  text: string,
  question: string,
  title?: string,
): Promise<string> {
  return callAi({ mode: "ask", text, question, title });
}

export function writeFromSources(
  instruction: string,
  sources: PaperSource[],
  draft?: string,
): Promise<string> {
  const compact: SourceContext[] = sources.map((s) => ({
    title: s.title,
    authors: s.authors,
    year: s.year,
    abstract: s.abstract,
  }));
  return callAi({ mode: "write", instruction, sources: compact, draft });
}

export function batchSummarizeSources(sources: PaperSource[]): Promise<string> {
  const compact: SourceContext[] = sources.map((s) => ({
    title: s.title,
    authors: s.authors,
    year: s.year,
    abstract: s.abstract,
  }));
  return callAi({ mode: "batch", sources: compact });
}

export function editText(text: string, instruction: string): Promise<string> {
  return callAi({ mode: "edit", text, instruction });
}

export function generateDiagram(text: string): Promise<string> {
  return callAi({ mode: "diagram", text });
}

export function exploreQuery(
  question: string,
  sources: PaperSource[],
): Promise<string> {
  return callAi({ mode: "explore", question, sources: toContext(sources).slice(0, 8) });
}

/** Propose distinct search angles for comprehensively covering a topic.
 *  When `allowedSources` is provided, the AI is asked to route each angle
 *  to one of those providers and the result is clamped to that set. */
export async function proposeSearchAngles(
  topic: string,
  allowedSources?: readonly SourceProvider[],
): Promise<SearchAngle[]> {
  const res = await callAi({
    mode: "angles",
    text: topic,
    allowedSources: allowedSources ? [...allowedSources] : undefined,
  });
  const pool = allowedSources ?? ALLOWED_SOURCES;
  const fallback: SourceProvider = pool[0] ?? "openalex";
  return parseJsonArray<SearchAngle>(res)
    .filter((a) => a && typeof a.query === "string" && a.query.trim().length > 0)
    .map((a) => ({
      query: a.query.trim(),
      rationale: a.rationale ?? "",
      source: pool.includes(a.source) ? a.source : fallback,
    }));
}

/** Score & cluster candidate sources by relevance to the topic. */
export async function triageSources(
  topic: string,
  sources: PaperSource[],
): Promise<SourceVerdict[]> {
  const raw = await callAi({
    mode: "triage",
    question: topic,
    sources: toContext(sources),
  });
  return parseJsonArray<SourceVerdict>(raw).filter(
    (v) => v && typeof v.n === "number",
  );
}

/** Identify coverage gaps in the gathered sources. */
export async function findGaps(
  topic: string,
  sources: PaperSource[],
): Promise<CoverageGap[]> {
  const raw = await callAi({
    mode: "gaps",
    question: topic,
    sources: toContext(sources),
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
): Promise<RefineTheme[]> {
  const raw = await callAi({
    mode: "refine",
    sources: toContext(sources).slice(0, 12),
    directions,
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
export function askLibrary(catalog: string, question: string): Promise<string> {
  return callAi({ mode: "libchat", text: catalog, question });
}

/** Auto-categorize the account library into themed groups of item keys. */
export async function categorizeLibrary(
  catalog: string,
): Promise<LibraryCategory[]> {
  const raw = await callAi({ mode: "libcat", text: catalog });
  return parseJsonArray<LibraryCategory>(raw)
    .filter((c) => c && typeof c.category === "string" && Array.isArray(c.keys))
    .map((c) => ({
      category: c.category.trim(),
      keys: c.keys.filter((k) => typeof k === "string" && k.trim()),
    }))
    .filter((c) => c.category && c.keys.length > 0);
}

/** A citation-audit verdict for one claim (Johns). `source` is the 1-based
 *  index into the audited source set, or null when unsupported. */
export interface AuditFinding {
  claim: string;
  status: "supported" | "weak" | "unsupported";
  source: number | null;
  note: string;
}

const AUDIT_STATUSES = new Set(["supported", "weak", "unsupported"]);

/** Johns — audit a draft's claims against the connected sources. */
export async function auditDraft(
  draft: string,
  sources: PaperSource[],
): Promise<AuditFinding[]> {
  const raw = await callAi({
    mode: "audit",
    draft,
    sources: toContext(sources),
  });
  return parseJsonArray<AuditFinding>(raw)
    .filter((f) => f && typeof f.claim === "string" && AUDIT_STATUSES.has(f.status))
    .map((f) => ({
      claim: f.claim.trim(),
      status: f.status,
      source:
        typeof f.source === "number" && f.source >= 1 ? Math.floor(f.source) : null,
      note: typeof f.note === "string" ? f.note.trim() : "",
    }));
}