import { NextRequest, NextResponse } from "next/server";

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
  | "synth";

interface SourceContext {
  title: string;
  authors?: string;
  year?: number;
  abstract?: string;
}

type SourceProvider = "openalex" | "arxiv" | "semanticscholar" | "wikipedia";

interface AiRequest {
  mode: AiMode;
  text?: string;
  title?: string;
  question?: string;
  instruction?: string;
  sources?: SourceContext[];
  draft?: string;
  allowedSources?: SourceProvider[];
  /** Free-text research directions, used by the `refine` mode. */
  directions?: string[];
  /** Lily's voice profile — injected into the `write` mode when present. */
  style?: string;
  /** An Agent's system prompt — when a node runs FROM an agent, its persona is
   *  prepended to the mode's instructions (VISION Phase 2). */
  persona?: string;
}

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
      const abstract = (s.abstract ?? "").slice(0, 2500);
      return `[${i + 1}] ${s.title}${meta ? ` (${meta})` : ""}\n${abstract}`;
    })
    .join("\n\n")
    .slice(0, MAX_CONTEXT_CHARS);
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<{ answer: string }>>> {
  let body: AiRequest;
  try {
    body = (await request.json()) as AiRequest;
  } catch {
    return NextResponse.json(
      { success: false, data: null, error: "Invalid request body.", configured: true },
      { status: 400 },
    );
  }

  const { mode, text, title, question, instruction, sources, draft, allowedSources, directions, style, persona } = body;
  const validModes: AiMode[] = ["summarize", "ask", "write", "batch", "edit", "diagram", "explore", "angles", "triage", "gaps", "refine", "libchat", "libcat", "audit", "dna", "synth"];
  if (!validModes.includes(mode)) {
    return NextResponse.json(
      { success: false, data: null, error: `Unknown mode: ${mode}`, configured: true },
      { status: 400 },
    );
  }

  if (mode === "write") {
    if (!instruction?.trim()) {
      return NextResponse.json(
        { success: false, data: null, error: "Tell the assistant what to write.", configured: true },
        { status: 400 },
      );
    }
    if (!sources || sources.length === 0) {
      return NextResponse.json(
        { success: false, data: null, error: "Connect at least one source to write from.", configured: true },
        { status: 400 },
      );
    }
  } else if (mode === "edit") {
    if (!text || text.trim().length < 10) {
      return NextResponse.json(
        { success: false, data: null, error: "Select or provide text to edit.", configured: true },
        { status: 400 },
      );
    }
    if (!instruction?.trim()) {
      return NextResponse.json(
        { success: false, data: null, error: "Specify what kind of edit to apply.", configured: true },
        { status: 400 },
      );
    }
  } else if (mode === "batch") {
    if (!sources || sources.length === 0) {
      return NextResponse.json(
        { success: false, data: null, error: "Connect at least one source.", configured: true },
        { status: 400 },
      );
    }
  } else if (mode === "diagram") {
    if (!text || text.trim().length < 20) {
      return NextResponse.json(
        { success: false, data: null, error: "Provide content to generate a diagram from.", configured: true },
        { status: 400 },
      );
    }
  } else if (mode === "explore") {
    if (!question?.trim()) {
      return NextResponse.json(
        { success: false, data: null, error: "Ask a question to explore.", configured: true },
        { status: 400 },
      );
    }
    if (!sources || sources.length === 0) {
      return NextResponse.json(
        { success: false, data: null, error: "No search results to synthesize from.", configured: true },
        { status: 400 },
      );
    }
  } else if (mode === "angles") {
    if (!text || text.trim().length < 3) {
      return NextResponse.json(
        { success: false, data: null, error: "Enter a topic to research.", configured: true },
        { status: 400 },
      );
    }
  } else if (mode === "triage" || mode === "gaps") {
    if (!question?.trim()) {
      return NextResponse.json(
        { success: false, data: null, error: "A topic is required.", configured: true },
        { status: 400 },
      );
    }
    if (!sources || sources.length === 0) {
      return NextResponse.json(
        { success: false, data: null, error: "No sources to evaluate.", configured: true },
        { status: 400 },
      );
    }
  } else if (mode === "refine") {
    if ((!sources || sources.length === 0) && (!directions || directions.length === 0)) {
      return NextResponse.json(
        { success: false, data: null, error: "Keep at least one source or set a research direction first.", configured: true },
        { status: 400 },
      );
    }
  } else if (mode === "libchat" || mode === "libcat") {
    if (!text || text.trim().length < 2) {
      return NextResponse.json(
        { success: false, data: null, error: "Your library is empty — add documents, sources, or media first.", configured: true },
        { status: 400 },
      );
    }
    if (mode === "libchat" && !question?.trim()) {
      return NextResponse.json(
        { success: false, data: null, error: "Ask a question first.", configured: true },
        { status: 400 },
      );
    }
  } else if (mode === "audit") {
    if (!draft || draft.trim().length < 20) {
      return NextResponse.json(
        { success: false, data: null, error: "Write a draft to audit first.", configured: true },
        { status: 400 },
      );
    }
    if (!sources || sources.length === 0) {
      return NextResponse.json(
        { success: false, data: null, error: "Connect sources to audit the draft against.", configured: true },
        { status: 400 },
      );
    }
  } else if (mode === "synth") {
    if (!sources || sources.length === 0) {
      return NextResponse.json(
        { success: false, data: null, error: "Connect at least one source to synthesize.", configured: true },
        { status: 400 },
      );
    }
  } else if (mode === "dna") {
    if (!text || text.trim().length < 200) {
      return NextResponse.json(
        { success: false, data: null, error: "Add a longer writing sample (a few paragraphs) so Lily can learn your voice.", configured: true },
        { status: 400 },
      );
    }
  } else {
    if (!text || text.trim().length < 20) {
      return NextResponse.json(
        { success: false, data: null, error: "No text to work with.", configured: true },
        { status: 400 },
      );
    }
    if (mode === "ask" && !question?.trim()) {
      return NextResponse.json(
        { success: false, data: null, error: "Ask a question first.", configured: true },
        { status: 400 },
      );
    }
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        configured: false,
        error:
          "AI is not configured. Add OPENROUTER_API_KEY to .env.local and restart.",
      },
      { status: 200 },
    );
  }

  const model =
    mode === "summarize" || mode === "ask" || mode === "angles" || mode === "gaps" || mode === "refine" || mode === "libchat" || mode === "libcat"
      ? MODEL_FAST
      : MODEL_BALANCED;

  const maxTokens =
    mode === "write" || mode === "edit"
      ? MAX_OUTPUT_WRITE
      : mode === "triage" || mode === "audit" || mode === "synth"
        ? 2048
        : MAX_OUTPUT_DEFAULT;

  let contextLabel: string;
  let contextBody: string;
  let userContent: string;

  if (mode === "edit") {
    contextLabel = "TEXT TO EDIT";
    contextBody = (text as string).slice(0, MAX_CONTEXT_CHARS);
    userContent = (instruction as string).trim();
  } else if (mode === "write") {
    contextLabel = "SOURCES";
    contextBody = buildSourcesBlock(sources as SourceContext[]);
    const draftExcerpt = (draft ?? "").slice(-4000);
    userContent = draftExcerpt
      ? `${instruction}\n\n---\nCurrent draft (continue from / match this):\n${draftExcerpt}`
      : (instruction as string);
  } else if (mode === "batch") {
    contextLabel = "PAPERS TO EXTRACT";
    contextBody = buildSourcesBlock(sources as SourceContext[]);
    userContent = "Extract the key claims and TL;DR for each paper listed above.";
  } else if (mode === "diagram") {
    contextLabel = "CONTENT TO DIAGRAM";
    contextBody = (text as string).slice(0, MAX_CONTEXT_CHARS);
    userContent = "Generate a Mermaid diagram from this content.";
  } else if (mode === "explore") {
    contextLabel = "SEARCH RESULTS";
    contextBody = buildSourcesBlock(sources as SourceContext[]);
    userContent = (question as string).trim();
  } else if (mode === "angles") {
    contextLabel = "TOPIC";
    contextBody = (text as string).slice(0, 2000);
    const pool = allowedSources ?? ["openalex", "arxiv", "semanticscholar", "wikipedia"];
    const poolList = pool.join(", ");
    userContent =
      pool.length < 4
        ? `Propose distinct search angles to comprehensively cover this topic. Route EVERY angle to one of ONLY these databases: ${poolList}. Do not use any other database.`
        : "Propose distinct search angles to comprehensively cover this topic.";
  } else if (mode === "triage") {
    contextLabel = "SOURCES";
    contextBody = buildSourcesBlock(sources as SourceContext[]);
    userContent = `Topic: ${(question as string).trim()}\n\nScore and cluster each source by relevance to this topic.`;
  } else if (mode === "gaps") {
    contextLabel = "SOURCES GATHERED SO FAR";
    contextBody = buildSourcesBlock(sources as SourceContext[]);
    userContent = `Topic: ${(question as string).trim()}\n\nWhat important coverage gaps remain?`;
  } else if (mode === "refine") {
    contextLabel = "KEPT SOURCES";
    contextBody = buildSourcesBlock(sources ?? []);
    const dirs = (directions ?? []).filter(Boolean).join("\n- ");
    userContent = dirs
      ? `Research directions:\n- ${dirs}\n\nCluster these sources into themes and propose search expansions.`
      : "Cluster these sources into themes and propose search expansions.";
  } else if (mode === "libchat") {
    contextLabel = "LIBRARY CATALOG";
    contextBody = (text as string).slice(0, MAX_CONTEXT_CHARS);
    userContent = (question as string).trim();
  } else if (mode === "libcat") {
    contextLabel = "LIBRARY CATALOG";
    contextBody = (text as string).slice(0, MAX_CONTEXT_CHARS);
    userContent = "Group these library items into themed categories.";
  } else if (mode === "audit") {
    contextLabel = "SOURCES";
    contextBody = buildSourcesBlock(sources as SourceContext[]);
    userContent = `Audit this draft's claims against the sources above.\n\nDRAFT:\n${(draft as string).slice(0, 12000)}`;
  } else if (mode === "dna") {
    contextLabel = "WRITING SAMPLE";
    contextBody = (text as string).slice(0, MAX_CONTEXT_CHARS);
    userContent = "Infer this author's reusable voice profile.";
  } else if (mode === "synth") {
    contextLabel = "SOURCES";
    contextBody = buildSourcesBlock(sources as SourceContext[]);
    userContent = "Synthesize these sources into claims, contradictions, and themes.";
  } else {
    contextLabel = "PAPER";
    contextBody = `${title ? `TITLE: ${title}\n\n` : ""}${(text as string).slice(0, MAX_CONTEXT_CHARS)}`;
    userContent = mode === "ask" ? (question as string) : "Summarize this paper.";
  }

  // Lily: condition the writer on the author's learned voice profile.
  const voiceBlock =
    mode === "write" && style?.trim()
      ? `\n\nAUTHOR VOICE PROFILE — write in this voice (it governs tone/rhythm/diction; never let it override factual accuracy or citations):\n${style.trim()}`
      : "";
  // A bound agent's persona leads the system prompt so it colours behavior
  // without discarding the mode's task-specific instructions.
  const personaBlock = persona?.trim() ? `${persona.trim()}\n\n` : "";
  const systemPrompt = `${personaBlock}${INSTRUCTIONS[mode]}\n\n${contextLabel}:\n${contextBody}${voiceBlock}`;

  try {
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
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(
        res.status === 429
          ? "Rate limited. Try again in a moment."
          : `OpenRouter: ${res.status} ${err.slice(0, 200)}`,
      );
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const answer = json.choices?.[0]?.message?.content?.trim() ?? "";

    return NextResponse.json({
      success: true,
      data: { answer },
      error: null,
      configured: true,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, data: null, error: getErrorMessage(error), configured: true },
      { status: 502 },
    );
  }
}