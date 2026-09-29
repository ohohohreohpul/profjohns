import type { PaperSource } from "./mock";
import { isJevConfigured, JevError, judgeReferenceMatch } from "./jev";

/**
 * E0.1 — Reference existence-verification (server-only).
 *
 * For each cited source, retrieve a candidate record from OpenAlex (by DOI when
 * available, else by title search) and judge whether it is the same work. With
 * `TYPESAFE_API_KEY` set, the same-work judgment is a Jev Noul question; without
 * it, a code-based fuzzy match (normalized title + year tolerance) is the
 * fallback so the feature is still useful offline.
 *
 * Retrieval failures per-reference become a `not-found` verdict with a note,
 * never a crash. Jev failures bubble up as `JevError` only when configured and
 * are caught by the `/api/jev` route into the standard envelope.
 */

const OPENALEX_ENDPOINT = "https://api.openalex.org/works";
const MAILTO = process.env.OPENALEX_MAILTO ?? "research@lattice.app";
const MATCH_THRESHOLD = 0.5;

export type ReferenceStatus = "verified" | "metadata-mismatch" | "not-found";

export interface ReferenceVerification {
  /** 0-based index into the input source list. */
  readonly index: number;
  readonly status: ReferenceStatus;
  /** Jev match probability, when Jev was used. */
  readonly probability?: number;
  /** Title of the OpenAlex candidate, when one was found. */
  readonly candidateTitle?: string;
  /** L04 — link to the OpenAlex candidate (landing page / DOI / work id), so
   *  a "not found" or "mismatch" verdict is actionable: the user can open the
   *  candidate to confirm or fix the citation. */
  readonly candidateUrl?: string;
  readonly note: string;
}

interface OaWork {
  id?: string;
  doi?: string;
  title?: string;
  display_name?: string;
  publication_year?: number;
  authorships?: Array<{ author?: { display_name?: string } }>;
  abstract_inverted_index?: Record<string, number[]>;
  primary_location?: { landing_page_url?: string; source?: { display_name?: string } };
  open_access?: { is_oa?: boolean };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

function formatAuthors(authorships: OaWork["authorships"]): string {
  const names = (authorships ?? [])
    .map((a) => a.author?.display_name?.trim())
    .filter(Boolean) as string[];
  if (names.length === 0) return "Unknown authors";
  if (names.length > 3) return `${names[0]} et al.`;
  return names.join(", ");
}

function stripMarkup(text: string): string {
  return text.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
}

/** Extract a DOI (10.xxxx/...) from a URL or bare string. */
function extractDoi(value?: string): string | null {
  if (!value) return null;
  const match = value.match(/10\.\d{4,9}\/[^\s)"'<>]+/i);
  return match ? match[0] : null;
}

function mapWork(work: OaWork): PaperSource {
  const title = stripMarkup((work.title ?? work.display_name ?? "").trim());
  return {
    id: work.id ?? work.doi ?? (title || "unknown"),
    title,
    authors: formatAuthors(work.authorships),
    venue: work.primary_location?.source?.display_name?.trim() || "OpenAlex",
    year: work.publication_year ?? new Date().getFullYear(),
    abstract: "No abstract available.",
    url: work.primary_location?.landing_page_url ?? work.doi ?? work.id,
    openAccess: work.open_access?.is_oa ?? false,
  };
}

/** Query OpenAlex for one candidate work matching `ref`. */
async function findReferenceCandidate(ref: PaperSource): Promise<PaperSource | null> {
  const doi = extractDoi(ref.url) ?? extractDoi(ref.id);
  let url: string;
  if (doi) {
    url = `${OPENALEX_ENDPOINT}?filter=doi:${encodeURIComponent(doi)}&per_page=1&mailto=${encodeURIComponent(MAILTO)}`;
  } else {
    url = `${OPENALEX_ENDPOINT}?search=${encodeURIComponent(ref.title)}&per_page=1&mailto=${encodeURIComponent(MAILTO)}`;
  }

  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": `ProfJohns (${MAILTO})` } });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return null;
  }
  const obj = json as { results?: OaWork[] };
  const work = obj.results?.[0];
  return work ? mapWork(work) : null;
}

/** Normalize a title for fuzzy comparison: lowercase, alphanumerics only. */
function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Code-based fallback match: near-identical normalized title + year tolerance. */
function fuzzyMatch(
  cited: { title: string; year?: number },
  candidate: { title: string; year?: number },
): boolean {
  const a = normalizeTitle(cited.title);
  const b = normalizeTitle(candidate.title);
  if (a.length === 0 || b.length === 0) return false;
  // Near-identical: one is a prefix of the other or equality, to tolerate
  // trailing subtitles/punctuation differences.
  const sameCore = a === b || a.startsWith(b) || b.startsWith(a);
  if (!sameCore) return false;
  // Year tolerance is judged separately in `metadataAligns`.
  return true;
}

function metadataAligns(
  cited: { year?: number },
  candidate: { year?: number },
): boolean {
  if (cited.year && candidate.year) {
    return Math.abs(cited.year - candidate.year) <= 1;
  }
  return true;
}

/**
 * Verify a list of cited references against OpenAlex. Returns one
 * `ReferenceVerification` per input, in order. When Jev is configured, the
 * same-work judgment uses a Noul probability; otherwise a code fuzzy match.
 */
export async function verifyReferences(
  refs: readonly PaperSource[],
): Promise<ReferenceVerification[]> {
  const useJev = isJevConfigured();
  const results: ReferenceVerification[] = [];

  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i];
    let candidate: PaperSource | null;
    try {
      candidate = await findReferenceCandidate(ref);
    } catch (err: unknown) {
      results.push({
        index: i,
        status: "not-found",
        note: `Lookup failed: ${getErrorMessage(err).slice(0, 80)}`,
      });
      continue;
    }

    if (!candidate) {
      results.push({
        index: i,
        status: "not-found",
        note: "No matching work found in OpenAlex.",
      });
      continue;
    }

    if (useJev) {
      try {
        const probability = await judgeReferenceMatch(
          { title: ref.title, authors: ref.authors, year: ref.year },
          { title: candidate.title, authors: candidate.authors, year: candidate.year },
        );
        const status: ReferenceStatus =
          probability >= MATCH_THRESHOLD && metadataAligns(ref, candidate)
            ? "verified"
            : probability >= MATCH_THRESHOLD
              ? "metadata-mismatch"
              : "not-found";
        results.push({
          index: i,
          status,
          probability,
          candidateTitle: candidate.title,
          candidateUrl: candidate.url,
          note:
            status === "verified"
              ? "Matched in OpenAlex."
              : status === "metadata-mismatch"
                ? "Matched, but title/authors/year differ."
                : "No confident match in OpenAlex.",
        });
      } catch (err: unknown) {
        // Jev failed mid-batch — surface as a JevError so the route can envelope
        // it, but only after recording the retrieval succeeded.
        if (err instanceof JevError) throw err;
        results.push({
          index: i,
          status: "not-found",
          candidateTitle: candidate.title,
          candidateUrl: candidate.url,
          note: `Match check failed: ${getErrorMessage(err).slice(0, 80)}`,
        });
      }
    } else {
      // Offline fallback: code fuzzy match.
      const matched = fuzzyMatch(ref, candidate);
      const status: ReferenceStatus = matched
        ? metadataAligns(ref, candidate)
          ? "verified"
          : "metadata-mismatch"
        : "not-found";
      results.push({
        index: i,
        status,
        candidateTitle: candidate.title,
        candidateUrl: candidate.url,
        note:
          status === "verified"
            ? "Matched in OpenAlex (offline match)."
            : status === "metadata-mismatch"
              ? "Title matches, but year differs."
              : "No confident match in OpenAlex.",
      });
    }
  }

  return results;
}