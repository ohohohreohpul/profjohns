import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiAuth } from "@/lib/security/api-auth";
import { withUsageTracking, sanitizeVendorError } from "@/lib/security/usage";
import { RATE_LIMITS } from "@/lib/security/rate-limit";

/**
 * AI boundary — OpenRouter backend.
 * One route, many modes:
 *   summarize / ask — paper reading (cheap, fast)
 *   write — draft from connected sources (balanced)
 *   edit — grammar, clarity, tone, expand
 *   batch — multi-paper key-claim extraction
 *   diagram — Mermaid generation from content
 *   explore — Perplexity-style synthesized search answer
 *
 * Uses OPENROUTER_API_KEY env var. Without it, returns graceful message.
 * Protected by withApiAuth: authentication, rate limiting, body validation.
 */

const OR_BASE = "https://openrouter.ai/api/v1/chat/completions";

// OpenRouter model IDs
const MODEL_FAST =
  process.env.OPENROUTER_MODEL_FAST ?? "anthropic/claude-haiku-4.5";
const MODEL_BALANCED =
  process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4";
const MODEL_FRONTIER =
  process.env.OPENROUTER_MODEL_FRONTIER ?? "anthropic/claude-opus-4";

const MAX_CONTEXT_CHARS = 60_000;
const MAX_OUTPUT_WRITE = 3072;
const MAX_OUTPUT_DEFAULT = 1024;

type AiMode =
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
  | "section"
  | "revise";

interface SourceContext {
  title: string;
  authors?: string;
  year?: number;
  abstract?: string;
  doi?: string;
  venue?: string;
}

type SourceProvider = "openalex" | "arxiv" | "semanticscholar" | "wikipedia";

const VALID_MODES: AiMode[] = [
  "summarize", "ask", "write", "batch", "edit", "diagram", "explore",
  "angles", "triage", "gaps", "refine", "libchat", "libcat", "audit",
  "dna", "synth", "vision", "complete", "titles", "outline", "section", "revise",
];

const WRITE_MODES: AiMode[] = ["write", "edit", "section"];

// Zod schema for request validation
const aiRequestSchema = z.object({
  mode: z.enum(VALID_MODES as [string, ...string[]]),
  text: z.string().max(200_000).optional(),
  title: z.string().max(500).optional(),
  question: z.string().max(10_000).optional(),
  instruction: z.string().max(10_000).optional(),
  sources: z.array(z.object({
    title: z.string().max(500),
    authors: z.string().max(500).optional(),
    year: z.number().int().optional(),
    abstract: z.string().max(50_000).optional(),
    doi: z.string().max(500).optional(),
    venue: z.string().max(500).optional(),
  })).max(50).optional(),
  draft: z.string().max(200_000).optional(),
  allowedSources: z.array(z.enum(["openalex", "arxiv", "semanticscholar", "wikipedia"])).optional(),
  directions: z.array(z.string().max(500)).max(20).optional(),
  style: z.string().max(20_000).optional(),
  persona: z.string().max(20_000).optional(),
  image: z.string().max(5_000_000).optional(),
}).refine(
  (data) => {
    if (data.mode === "vision") return !!data.image?.trim();
    return true;
  },
  { message: "No image provided for vision mode." },
);

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  configured: boolean;
}

const INSTRUCTIONS: Record<AiMode, string> = {
  summarize:
    "You are a precise research assistant. Summarize the paper using ONLY the provided text. Return: a two-sentence TL;DR, then 4-6 key claims as '- ' bullets, then a one-line 'Limitations:' if the paper states any. Do not invent.",
  ask:
    "You are a precise research assistant. Answer using ONLY the provided paper text. If the answer isn't in the text, say so. Quote short phrases when helpful.",
  write:
    "You are an advanced academic writing assistant embedded in a document editor. Carry out the user's instruction precisely, grounding every claim in the provided sources and citing them inline as (Author, Year). Write in a clear, confident academic tone — avoid hedging, passive voice, and filler. Match the structure and style of any existing draft. Return finished prose only — no preamble, no meta-commentary, no headings unless explicitly asked.",
  batch:
    "You are a precise research assistant. For each paper listed, extract: one-sentence TL;DR and three key claims as '- ' bullets. Format EXACTLY:\n\n--- PAPER: [number] ---\nTL;DR: ...\nKey claims:\n- ...\n- ...\n- ...\n\nBe faithful to the abstracts. Return ONLY the formatted output.",
  edit:
    "You are an expert academic editor embedded in a document editor. Carry out the user's editing instruction on the provided text. Options include: fix grammar and clarity, adjust tone (more formal / more accessible / more persuasive), expand a point with depth and evidence, tighten prose, improve flow and transitions. Return ONLY the edited text — no preamble, no explanations, no meta-commentary.",
  diagram:
    "You are a precise diagram generator. Analyze the provided content and create a Mermaid.js diagram that visualizes the structure, relationships, or flow. Choose the most appropriate diagram type: flowchart for processes, classDiagram for hierarchies, graph TD for mind-maps, sequenceDiagram for steps, or erDiagram for relationships. Return ONLY valid Mermaid syntax — no markdown fences, no explanations, no preamble. The first line should be the diagram type declaration.",
  explore:
    "You are a knowledgeable research assistant answering a user's query. Synthesize information from the provided sources into a clear, comprehensive answer. Use [1], [2] style inline citations referencing the source numbers. Structure your answer with a brief overview followed by detailed sections when appropriate. Be accurate — never invent information not present in the sources. If sources don't cover something, say so plainly. Write in a clear, engaging style suitable for a curious reader.",
  angles:
    "You are a research librarian who routes each search to the right database. Databases: 'openalex' = scholarly works across ALL fields (sciences, medicine, social science, humanities, literature) — your DEFAULT for scholarship; 'arxiv' = preprints in physics, math, CS, statistics and other quantitative fields ONLY; 'semanticscholar' = computer-science / AI work where citation graph matters; 'wikipedia' = general background, definitions, and history ONLY — NEVER for finding primary scholarship or literature. Given a topic, propose 4-6 DISTINCT search angles that together comprehensively surface the relevant work — vary them by sub-question, terminology/synonyms, methodology, and seminal authors — and choose the single best database for EACH angle based on the topic's field. Prefer openalex unless the angle clearly fits arxiv or semanticscholar. Return ONLY a JSON array, with no prose and no code fences: [{\"query\": string, \"rationale\": string, \"source\": \"openalex\" | \"arxiv\" | \"semanticscholar\" | \"wikipedia\"}]. query = a concrete search string; rationale = at most 12 words on why this angle matters.",
  triage:
    "You are a research librarian screening search results against a topic. For EACH numbered source, judge its relevance and group it. Return ONLY a JSON array, with no prose and no code fences: [{\"n\": number, \"score\": number, \"why\": string, \"cluster\": string}]. n = the source's number from the list; score = 0-100 relevance to the topic; why = at most 14 words; cluster = a short 1-3 word theme label, reused consistently across similar sources. Include every source exactly once.",
  gaps:
    "You are a research advisor reviewing the sources gathered for a topic. Identify 2-3 important COVERAGE GAPS — perspectives, methods, populations, time periods, or counter-arguments missing from the set. Return ONLY a JSON array, with no prose and no code fences: [{\"gap\": string, \"query\": string}]. gap = at most 12 words on what is missing; query = a concrete search to fill it.",
  refine:
    "You are a research librarian refining a user's interest profile. Given the user's kept sources and stated directions, cluster the corpus into 3-5 coherent themes and propose 1-2 concrete OpenAlex search expansions per theme (queries or concept phrases the user hasn't searched yet). Return ONLY a JSON array, with no prose and no code fences: [{\"theme\": string, \"queries\": [string]}]. theme = a short 1-3 word label; queries = concrete search strings.",
  libchat:
    "You are the assistant for a user's personal research library. Answer ONLY from the catalog of library items provided (each line is '[key] kind | title | projects | details'). Help the user locate items, see connections across projects, and decide what to revisit. Refer to items by their title, and mention which project they live in when useful. Be concise and concrete. If something is not in the library, say so plainly — never invent items.",
  libcat:
    "You are organizing a user's research library into a clean set of themes. Read the catalog (each line is '[key] kind | title | projects | details') and group the items into 4-8 meaningful, non-overlapping categories by subject/theme (not by file type). Return ONLY a JSON array, no prose or code fences: [{\"category\": string, \"keys\": [string]}]. category = a short 1-3 word human label; keys = the exact [key] values that belong to it. Every item should appear in exactly one category; omit a key only if it truly fits nowhere.",
  synth:
    "You are a research synthesist working over a numbered list of SOURCES. Produce a STRUCTURED synthesis. Return ONLY a JSON object (no prose, no code fences): {\"claims\": [{\"claim\": string, \"sources\": [number], \"evidence\": string}], \"contradictions\": [{\"claim\": string, \"sources\": [number], \"note\": string}], \"themes\": [{\"theme\": string, \"sources\": [number]}]}. claim = a substantive finding stated plainly (<=140 chars); evidence = at most 18 words on what backs it; sources = the 1-based numbers of the sources that support each item; contradictions = genuine disagreements between sources (cite the conflicting source numbers, note what differs); themes = 2-4 short cross-cutting topic labels. Ground everything in the provided sources — never invent claims, numbers, or sources. Aim for up to ~8 claims.",
  dna:
    "You are a writing-voice analyst. From the author's writing sample(s), infer a concise, reusable VOICE PROFILE another writer could follow to sound like this author. Cover: overall tone/register; sentence length & rhythm; preferred structure (how they open, build, and conclude an argument); diction & favored/avoided words; use of hedging vs. assertion; how they handle citations and evidence; and any signature habits. Return PLAIN PROSE (no JSON), ~120-180 words, written as direct guidance ('Write in...', 'Prefer...', 'Avoid...'). Describe only what the sample evidences — do not invent.",
  outline:
    "You are a paper-structure planner. From the numbered SOURCES (and CLAIMS when given), propose a logical section outline for an academic paper on this material — typically 4 to 7 sections from introduction through conclusion, specific to THIS body of evidence (not generic boilerplate). Return ONLY a JSON array of section-title strings, no numbering, no prose, no code fences.",
  section:
    "You are an academic section writer. Write ONE section of a paper using ONLY the numbered SOURCES provided (and the CLAIMS, which are grounded in them). Cite every factual statement inline with its source number in square brackets, e.g. [1] or [2], matching the SOURCES numbering exactly — never invent a citation or cite a number that is not in the list. 2-4 paragraphs of clear academic prose. Output ONLY the section body (no heading, no preamble).",
  revise:
    "You are an academic writing reviser. You receive a section of text, an instruction for what to change, and the sources it was written from. Rewrite the section following the instruction precisely. Preserve all existing citation markers [n] — keep the same source numbers unless the instruction explicitly asks to remove or add citations. If the instruction asks to add citations, use only sources from the SOURCES list. Return ONLY the revised section text — no preamble, no meta-commentary.",
  complete:
    "You are an inline writing autocomplete inside an academic document editor. Continue the author's text naturally from exactly where it ends. Output ONLY the continuation — no preamble, no quotes, no explanation. At most one sentence (~16 words). If the text ends mid-word, finish that word first. Match the author's tone and topic; never repeat what is already written.",
  titles:
    "You are an academic titling assistant. From the draft, propose 5 concise, specific, publishable paper titles (each under ~15 words, no numbering). Return ONLY a JSON array of strings — no prose, no code fences.",
  vision:
    "You are a vision analyst for academic figures. Describe the image precisely and usefully for a researcher: what it depicts, the figure/chart type, axes/labels/legend, the key values or trends it shows, and any visible caption or text. Be strictly factual — describe only what is visible, never speculate beyond the image. Return clear prose (no preamble).",
  audit:
    "You are a meticulous citation auditor. You are given a draft and a numbered list of the SOURCES available to the author. Identify the draft's distinct factual/empirical CLAIMS (skip the author's own framing, transitions, and opinions) and judge whether each is backed by the provided sources. Return ONLY a JSON array, no prose or code fences: [{\"claim\": string, \"status\": \"supported\" | \"weak\" | \"unsupported\", \"source\": number | null, \"note\": string}]. claim = the claim quoted or closely paraphrased (<=160 chars); status = 'supported' if a source clearly backs it, 'weak' if a source is only tangentially related or partially supports it, 'unsupported' if no provided source backs it; source = the 1-based number of the best supporting source, or null when unsupported; note = at most 16 words on why. Be strict — never credit a source that does not actually contain the claim. Cover the most important claims (up to ~12).",
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

function buildSourcesBlock(sources: SourceContext[]): string {
  return sources
    .slice(0, 12)
    .map((s, i) => {
      const meta = [s.authors, s.year].filter(Boolean).join(", ");
      const venue = s.venue ? `. ${s.venue}` : "";
      const doi = s.doi ? `. DOI: ${s.doi}` : "";
      const abstract = (s.abstract ?? "").slice(0, 2500);
      return `[${i + 1}] ${s.title}${meta ? ` (${meta})` : ""}${venue}${doi}\n${abstract}`;
    })
    .join("\n\n")
    .slice(0, MAX_CONTEXT_CHARS);
}

export const POST = withApiAuth(
  {
    schema: aiRequestSchema,
    rateLimit: RATE_LIMITS.ai,
    maxBodyBytes: 500_000,
  },
  async ({ user, body }) => {
    const { mode, text, title, question, instruction, sources, draft, allowedSources, directions, style, persona, image } = body as z.infer<typeof aiRequestSchema> & { mode: AiMode };

    // Semantic validation (beyond zod structural validation)
    const semanticError = validateModeSemantics(mode, body);
    if (semanticError) {
      return NextResponse.json(
        { success: false, data: null, error: semanticError, configured: true },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          configured: false,
          error: "AI is not configured. Add OPENROUTER_API_KEY to .env.local and restart.",
        },
        { status: 200 },
      );
    }

  const model =
    mode === "summarize" || mode === "ask" || mode === "angles" || mode === "gaps" || mode === "refine" || mode === "libchat" || mode === "libcat" || mode === "complete" || mode === "titles" || mode === "outline"
      ? MODEL_FAST
      : MODEL_BALANCED;

  const maxTokens =
    mode === "write" || mode === "edit" || mode === "section" || mode === "revise"
      ? MAX_OUTPUT_WRITE
      : mode === "triage" || mode === "audit" || mode === "synth"
          ? 2048
          : mode === "complete"
            ? 48
            : mode === "titles"
              ? 320
              : MAX_OUTPUT_DEFAULT;

    const { contextLabel, contextBody, userContent } = buildContext(mode, body as Record<string, unknown>);

    const voiceBlock =
      (mode === "write" || mode === "section") && style?.trim()
        ? `\n\nAUTHOR VOICE PROFILE — write in this voice (it governs tone/rhythm/diction; never let it override factual accuracy or citations):\n${style.trim()}`
        : "";
    const personaBlock = persona?.trim() ? `${persona.trim()}\n\n` : "";
    const systemPrompt = `${personaBlock}${INSTRUCTIONS[mode]}\n\n${contextLabel}:\n${contextBody}${voiceBlock}`;

    try {
      const { result: json } = await withUsageTracking(
        {
          userId: user.id,
          vendor: "openrouter",
          model,
          requestType: `ai:${mode}`,
          timeoutMs: 30_000,
        },
        async (signal) => {
          const res = await fetch(OR_BASE, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
              "HTTP-Referer": process.env.APP_URL ?? "http://localhost:3000",
              "X-Title": "ProfJohns",
            },
            body: JSON.stringify({
              model,
              max_tokens: maxTokens,
              messages: [
                { role: "system", content: systemPrompt },
                mode === "vision" && image
                  ? {
                      role: "user",
                      content: [
                        { type: "text", text: userContent },
                        { type: "image_url", image_url: { url: image } },
                      ],
                    }
                  : { role: "user", content: userContent },
              ],
            }),
            signal,
          });

          if (!res.ok) {
            throw new Error(`VENDOR:${res.status}`);
          }

          return (await res.json()) as {
            choices?: { message?: { content?: string } }[];
            usage?: { total_tokens?: number };
          };
        },
      );

      const answer = json.choices?.[0]?.message?.content?.trim() ?? "";

      return NextResponse.json({
        success: true,
        data: { answer },
        error: null,
        configured: true,
      });
    } catch (error: unknown) {
      const isVendorError = error instanceof Error && error.message.startsWith("VENDOR:");
      const status = isVendorError ? parseInt(error.message.split(":")[1], 10) : 502;
      const message = isVendorError
        ? sanitizeVendorError("OpenRouter", status)
        : error instanceof Error && error.name === "AbortError"
          ? "The request timed out. Please try again."
          : "An unexpected error occurred.";

      return NextResponse.json(
        { success: false, data: null, error: message, configured: true },
        { status: isVendorError && status === 429 ? 429 : 502 },
      );
    }
  },
);

function validateModeSemantics(mode: AiMode, body: Record<string, unknown>): string | null {
  const text = body.text as string | undefined;
  const instruction = body.instruction as string | undefined;
  const question = body.question as string | undefined;
  const sources = body.sources as SourceContext[] | undefined;
  const draft = body.draft as string | undefined;
  const directions = body.directions as string[] | undefined;

  if (mode === "write") {
    if (!instruction?.trim()) return "Tell the assistant what to write.";
    if (!sources || sources.length === 0) return "Connect at least one source to write from.";
  } else if (mode === "edit") {
    if (!text || text.trim().length < 10) return "Select or provide text to edit.";
    if (!instruction?.trim()) return "Specify what kind of edit to apply.";
  } else if (mode === "batch") {
    if (!sources || sources.length === 0) return "Connect at least one source.";
  } else if (mode === "diagram") {
    if (!text || text.trim().length < 20) return "Provide content to generate a diagram from.";
  } else if (mode === "explore") {
    if (!question?.trim()) return "Ask a question to explore.";
    if (!sources || sources.length === 0) return "No search results to synthesize from.";
  } else if (mode === "angles") {
    if (!text || text.trim().length < 3) return "Enter a topic to research.";
  } else if (mode === "triage" || mode === "gaps") {
    if (!question?.trim()) return "A topic is required.";
    if (!sources || sources.length === 0) return "No sources to evaluate.";
  } else if (mode === "refine") {
    if ((!sources || sources.length === 0) && (!directions || directions.length === 0))
      return "Keep at least one source or set a research direction first.";
  } else if (mode === "libchat" || mode === "libcat") {
    if (!text || text.trim().length < 2) return "Your library is empty — add documents, sources, or media first.";
    if (mode === "libchat" && !question?.trim()) return "Ask a question first.";
  } else if (mode === "audit") {
    if (!draft || draft.trim().length < 20) return "Write a draft to audit first.";
    if (!sources || sources.length === 0) return "Connect sources to audit the draft against.";
  } else if (mode === "synth") {
    if (!sources || sources.length === 0) return "Connect at least one source to synthesize.";
  } else if (mode === "dna") {
    if (!text || text.trim().length < 200) return "Add a longer writing sample (a few paragraphs) so Lily can learn your voice.";
  } else if (mode === "revise") {
    if (!text || text.trim().length < 20) return "Select a section to revise.";
    if (!instruction?.trim()) return "Specify what to change in the section.";
    if (!sources || sources.length === 0) return "Connect sources for citation grounding.";
  } else if (mode === "titles") {
    if ((!draft || draft.trim().length < 20) && (!text || text.trim().length < 20)) return "Write a draft first to suggest titles.";
  } else if (mode === "vision") {
    const image = body.image as string | undefined;
    if (!image?.trim()) return "No image provided.";
  } else if (mode === "outline") {
    if (!sources || sources.length === 0) return "Connect at least one source to outline.";
  } else if (mode === "section") {
    if (!question?.trim()) return "A section title is required.";
    if (!sources || sources.length === 0) return "Connect at least one source.";
  } else if (mode === "complete") {
    if (!text || text.trim().length < 1) return "No text to continue.";
  } else {
    // summarize, ask — need text
    if (!text || text.trim().length < 20) return "No text to work with.";
    if (mode === "ask" && !question?.trim()) return "Ask a question first.";
  }
  return null;
}

function buildContext(mode: AiMode, body: Record<string, unknown>): {
  contextLabel: string;
  contextBody: string;
  userContent: string;
} {
  const text = (body.text as string | undefined) ?? "";
  const title = body.title as string | undefined;
  const question = (body.question as string | undefined) ?? "";
  const instruction = (body.instruction as string | undefined) ?? "";
  const sources = (body.sources as SourceContext[] | undefined) ?? [];
  const draft = (body.draft as string | undefined) ?? "";
  const allowedSources = (body.allowedSources as SourceProvider[] | undefined);
  const directions = (body.directions as string[] | undefined) ?? [];

  if (mode === "edit") {
    return { contextLabel: "TEXT TO EDIT", contextBody: text.slice(0, MAX_CONTEXT_CHARS), userContent: instruction.trim() };
  } else if (mode === "write") {
    const draftExcerpt = draft.slice(-4000);
    return {
      contextLabel: "SOURCES",
      contextBody: buildSourcesBlock(sources),
      userContent: draftExcerpt ? `${instruction}\n\n---\nCurrent draft (continue from / match this):\n${draftExcerpt}` : instruction,
    };
  } else if (mode === "batch") {
    return { contextLabel: "PAPERS TO EXTRACT", contextBody: buildSourcesBlock(sources), userContent: "Extract the key claims and TL;DR for each paper listed above." };
  } else if (mode === "diagram") {
    return { contextLabel: "CONTENT TO DIAGRAM", contextBody: text.slice(0, MAX_CONTEXT_CHARS), userContent: "Generate a Mermaid diagram from this content." };
  } else if (mode === "explore") {
    return { contextLabel: "SEARCH RESULTS", contextBody: buildSourcesBlock(sources), userContent: question.trim() };
  } else if (mode === "angles") {
    const pool = allowedSources ?? ["openalex", "arxiv", "semanticscholar", "wikipedia"];
    const poolList = pool.join(", ");
    return {
      contextLabel: "TOPIC",
      contextBody: text.slice(0, 2000),
      userContent: pool.length < 4
        ? `Propose distinct search angles to comprehensively cover this topic. Route EVERY angle to one of ONLY these databases: ${poolList}. Do not use any other database.`
        : "Propose distinct search angles to comprehensively cover this topic.",
    };
  } else if (mode === "triage") {
    return { contextLabel: "SOURCES", contextBody: buildSourcesBlock(sources), userContent: `Topic: ${question.trim()}\n\nScore and cluster each source by relevance to this topic.` };
  } else if (mode === "gaps") {
    return { contextLabel: "SOURCES GATHERED SO FAR", contextBody: buildSourcesBlock(sources), userContent: `Topic: ${question.trim()}\n\nWhat important coverage gaps remain?` };
  } else if (mode === "refine") {
    const dirs = directions.filter(Boolean).join("\n- ");
    return {
      contextLabel: "KEPT SOURCES",
      contextBody: buildSourcesBlock(sources),
      userContent: dirs ? `Research directions:\n- ${dirs}\n\nCluster these sources into themes and propose search expansions.` : "Cluster these sources into themes and propose search expansions.",
    };
  } else if (mode === "libchat") {
    return { contextLabel: "LIBRARY CATALOG", contextBody: text.slice(0, MAX_CONTEXT_CHARS), userContent: question.trim() };
  } else if (mode === "libcat") {
    return { contextLabel: "LIBRARY CATALOG", contextBody: text.slice(0, MAX_CONTEXT_CHARS), userContent: "Group these library items into themed categories." };
  } else if (mode === "audit") {
    return { contextLabel: "SOURCES", contextBody: buildSourcesBlock(sources), userContent: `Audit this draft's claims against the sources above.\n\nDRAFT:\n${draft.slice(0, 12000)}` };
  } else if (mode === "dna") {
    return { contextLabel: "WRITING SAMPLE", contextBody: text.slice(0, MAX_CONTEXT_CHARS), userContent: "Infer this author's reusable voice profile." };
  } else if (mode === "synth") {
    return { contextLabel: "SOURCES", contextBody: buildSourcesBlock(sources), userContent: "Synthesize these sources into claims, contradictions, and themes." };
  } else if (mode === "outline") {
    const claims = text.trim();
    return {
      contextLabel: "SOURCES",
      contextBody: buildSourcesBlock(sources),
      userContent: claims ? `CLAIMS from the author's synthesis:\n${claims.slice(0, 4000)}\n\nPropose the section outline.` : "Propose the section outline.",
    };
  } else if (mode === "section") {
    const claims = text.trim();
    const outlineList = directions.filter(Boolean).join(" | ");
    return {
      contextLabel: "SOURCES",
      contextBody: buildSourcesBlock(sources),
      userContent: [
        `Write the section titled: "${question.trim()}"`,
        outlineList ? `Full paper outline (for flow/context): ${outlineList}` : "",
        claims ? `CLAIMS from the author's synthesis (grounded in the sources):\n${claims.slice(0, 4000)}` : "",
      ].filter(Boolean).join("\n\n"),
    };
  } else if (mode === "complete") {
    return { contextLabel: "DOCUMENT SO FAR (continue from the very end)", contextBody: text.slice(-3000), userContent: "Continue the document from exactly where it ends." };
  } else if (mode === "titles") {
    return { contextLabel: "DRAFT", contextBody: (draft || text).slice(0, 8000), userContent: "Suggest 5 title options for this paper." };
  } else if (mode === "vision") {
    return { contextLabel: "FIGURE CAPTION", contextBody: text.slice(0, 2000) || "(none provided)", userContent: question.trim() || "Describe this figure in detail for a researcher." };
  } else if (mode === "revise") {
    return {
      contextLabel: "SOURCES",
      contextBody: buildSourcesBlock(sources ?? []),
      userContent: `Revise the following section per this instruction: ${(instruction as string).trim()}\n\n---\nSECTION TO REVISE:\n${text.slice(0, 8000)}`,
    };
  } else {
    return { contextLabel: "PAPER", contextBody: `${title ? `TITLE: ${title}\n\n` : ""}${text.slice(0, MAX_CONTEXT_CHARS)}`, userContent: mode === "ask" ? question : "Summarize this paper." };
  }
}