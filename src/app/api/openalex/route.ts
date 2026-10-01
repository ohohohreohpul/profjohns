import { NextRequest, NextResponse } from "next/server";
import type { PaperSource } from "@/lib/mock";
import { toOpenAlexSearch, toTitleAbstractFilter, mergeUnique } from "@/lib/openalex-query";
import { interleave } from "@/lib/source-pool";

/**
 * Proxies the OpenAlex Works API — keyless, covers ALL fields (sciences,
 * humanities, social science, literature), and far more generous than the
 * keyless Semantic Scholar tier. This is ProfJohns's primary discovery index.
 * A `mailto` opts into OpenAlex's faster "polite pool".
 */

const ENDPOINT = "https://api.openalex.org/works";
const LIMIT = 8;
const MAILTO = process.env.OPENALEX_MAILTO ?? "research@lattice.app";

/** In-memory response cache — 5 min TTL. Repeat visits and multiple tabs
 *  served from cache, so we don't hammer OpenAlex and trigger 429s. */
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 60;
const cache = new Map<string, { data: PaperSource[]; expiry: number }>();

function readCache(key: string): PaperSource[] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiry) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}

function writeCache(key: string, data: PaperSource[]): void {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

/** Stale-while-revalidate: return expired data rather than nothing on 429. */
function readStaleCache(key: string): PaperSource[] | null {
  const hit = cache.get(key);
  return hit?.data ?? null;
}

const RETRY_DELAY_MS = 800;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

interface OAWork {
  id?: string;
  doi?: string;
  title?: string;
  display_name?: string;
  publication_year?: number;
  cited_by_count?: number;
  abstract_inverted_index?: Record<string, number[]>;
  authorships?: Array<{ author?: { display_name?: string } }>;
  primary_location?: {
    landing_page_url?: string;
    source?: { display_name?: string };
    is_oa?: boolean;
  };
  open_access?: { is_oa?: boolean };
  concepts?: Array<{ id?: string; display_name?: string; score?: number }>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

function formatAuthors(authorships: OAWork["authorships"]): string {
  const names = (authorships ?? [])
    .map((a) => a.author?.display_name?.trim())
    .filter(Boolean) as string[];
  if (names.length === 0) return "Unknown authors";
  if (names.length > 3) return `${names[0]} et al.`;
  return names.join(", ");
}

/** OpenAlex stores abstracts as an inverted index — rebuild the prose. */
function rebuildAbstract(index: OAWork["abstract_inverted_index"]): string {
  if (!index) return "No abstract available.";
  const slots: string[] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const pos of positions) slots[pos] = word;
  }
  const text = slots.filter(Boolean).join(" ").trim();
  return text.length > 0 ? text : "No abstract available.";
}

/** OpenAlex titles occasionally embed inline HTML (e.g. <i>…</i>). */
function stripMarkup(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

function mapWork(work: OAWork): PaperSource {
  const title = stripMarkup((work.title ?? work.display_name ?? "").trim());
  // Keep the top concepts by OpenAlex score — enough to train "For You"
  // without bloating every kept-source payload.
  const concepts = (work.concepts ?? [])
    .filter((c) => c.id && c.display_name)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 8)
    .map((c) => ({ id: c.id as string, name: (c.display_name as string).trim() }));
  const isOa = work.open_access?.is_oa ?? work.primary_location?.is_oa ?? false;
  return {
    id: work.id ?? work.doi ?? (title || "unknown"),
    title,
    authors: formatAuthors(work.authorships),
    venue: work.primary_location?.source?.display_name?.trim() || "OpenAlex",
    year: work.publication_year ?? new Date().getFullYear(),
    abstract: rebuildAbstract(work.abstract_inverted_index),
    citations: work.cited_by_count,
    url: work.primary_location?.landing_page_url ?? work.doi ?? work.id,
    concepts: concepts.length > 0 ? concepts : undefined,
    openAccess: isOa,
  };
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<PaperSource[]>>> {
  const rawQuery = request.nextUrl.searchParams.get("q")?.trim();
  // Cleaned before the emptiness check: "?" alone must not become an empty
  // search (which OpenAlex answers with every work in the index).
  const query = rawQuery ? toOpenAlexSearch(rawQuery) : "";
  if (!query) {
    return NextResponse.json(
      { success: false, data: null, error: "Missing query." },
      { status: 400 },
    );
  }

  // Discover feed asks for recent work in an interest; default is relevance.
  const sort = request.nextUrl.searchParams.get("sort");
  const sortParam =
    sort === "date"
      ? "&sort=publication_date:desc"
      : sort === "cited"
        ? "&sort=cited_by_count:desc"
        : "";
  const perPage = request.nextUrl.searchParams.get("limit") ?? String(LIMIT);
  // Optional time-range filter: `range=1y|5y|all` → from_publication_date.
  const range = request.nextUrl.searchParams.get("range");
  const fromDate =
    range === "1y"
      ? new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
      : range === "5y"
        ? new Date(Date.now() - 5 * 365 * 86400000).toISOString().slice(0, 10)
        : null;
  // "For You" queries by OpenAlex concept ids instead of free text. When
  // `concepts` is present, we skip `search=` and filter by concept id(s).
  const conceptsParam = request.nextUrl.searchParams.get("concepts")?.trim();
  const conceptIds = conceptsParam
    ? conceptsParam.split(",").map((c) => c.trim()).filter(Boolean)
    : [];

  const filters: string[] = [];
  if (fromDate) filters.push(`from_publication_date:${fromDate}`);
  if (conceptIds.length > 0) {
    // OpenAlex OR-syntax inside a single filter: concepts.id:C1|C2|C3
    filters.push(`concepts.id:${conceptIds.join("|")}`);
  }
  const base =
    `${ENDPOINT}?per_page=${encodeURIComponent(perPage)}${sortParam}` +
    `&mailto=${encodeURIComponent(MAILTO)}`;
  const filterParam = (extra: string[] = []): string => {
    const all = [...filters, ...extra];
    return all.length > 0 ? `&filter=${encodeURIComponent(all.join(","))}` : "";
  };

  // Concept queries ("For You") and explicitly sorted feeds (Discover) keep
  // their single request. Typed searches go precise-first (see
  // toTitleAbstractFilter) and top up from the broad search when the precise
  // one is too strict — a full natural-language question matches nothing
  // there, because every word must appear.
  const isTypedSearch = conceptIds.length === 0 && !sortParam;
  const broadUrl =
    conceptIds.length > 0
      ? `${base}${filterParam()}`
      : `${base}&search=${encodeURIComponent(query)}${filterParam()}`;
  const preciseFilter = isTypedSearch ? toTitleAbstractFilter(query) : null;
  const preciseUrl = preciseFilter ? `${base}${filterParam([preciseFilter])}` : null;
  const limit = Number(perPage) || LIMIT;

  const cacheKey = preciseUrl ? `precise+broad|${broadUrl}` : broadUrl;

  // Serve from cache first — repeat visits are instant and rate-limit-safe.
  const cached = readCache(cacheKey);
  if (cached) {
    return NextResponse.json({ success: true, data: cached, error: null });
  }

  try {
    // Alternate precise and broad results: precise surfaces the specific
    // recent papers, broad covers queries the precise filter mangles, and the
    // relevance screen downstream sorts out which is which. A failed precise
    // request is not fatal; the broad search still runs.
    const [precise, broad] = await Promise.all([
      preciseUrl ? fetchPapers(preciseUrl).catch(() => []) : Promise.resolve([]),
      fetchPapers(broadUrl),
    ]);
    const papers = mergeUnique(interleave([precise, broad]), [], limit);
    writeCache(cacheKey, papers);
    return NextResponse.json({ success: true, data: papers, error: null });
  } catch (error: unknown) {
    // Return stale cache on any failure rather than a bare 502.
    const stale = readStaleCache(cacheKey);
    if (stale) {
      return NextResponse.json({ success: true, data: stale, error: null });
    }
    return NextResponse.json(
      { success: false, data: null, error: getErrorMessage(error) },
      { status: 502 },
    );
  }
}

/** One OpenAlex request with a single 429 retry, mapped to PaperSource. */
async function fetchPapers(url: string): Promise<PaperSource[]> {
  const headers = { "User-Agent": `ProfJohns (${MAILTO})` };
  let res = await fetch(url, { headers });
  if (res.status === 429) {
    await sleep(RETRY_DELAY_MS);
    res = await fetch(url, { headers });
  }
  if (!res.ok) {
    throw new Error(
      res.status === 429
        ? "OpenAlex is busy. Try again in a moment."
        : `OpenAlex returned ${res.status}.`,
    );
  }
  const json = (await res.json()) as { results?: OAWork[] };
  const maxYear = new Date().getFullYear() + 1;
  return (json.results ?? [])
    .map(mapWork)
    .filter((p) => p.title.length > 0 && p.year <= maxYear);
}
