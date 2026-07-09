# ProfJohns — Vision to Architecture

> The product we are building, the distance between it and what exists today, and
> the staged engineering plan to close that distance. Companion to `SPEC.md`
> (canonical feature spec) and `REDESIGN.md` (visual direction).

---

## 1. The vision

ProfJohns is an **agentic research workspace** where a researcher (medical students
first) thinks on a canvas while a set of **personal AI agents** do the heavy
lifting:

1. **Find** — agents search scholarly sources (text *and* figures), including
   **reverse/semantic retrieval** that surfaces papers keyword search misses.
2. **Work while you sleep** — standing agentic jobs run server-side,
   continuously, accumulating relevant papers and figures so nothing is missed.
3. **Trained on you** — agents you configure and *train on your own corpus*:
   a relevance + counter-source scout, a writer that argues **in your dialect**,
   a citation-convention enforcer. Configured on a dedicated Agents surface,
   usable inside Canvas.
4. **Compose** — your trained writing agent drafts a full academic paper from
   the curated sources, in your voice, with verified citations.

### Principles
- **Human-in-the-loop.** Agents propose; the researcher curates and decides.
- **Artifacts, not blobs.** Connections carry curated objects (kept sources,
  claims, figures), never raw text.
- **Provenance everywhere.** Every claim traces to a source; every citation is
  verified to exist.
- **Canvas is the cockpit.** All agent work surfaces as nodes on the canvas.

---

## 2. Current state (as-built, honest)

| Layer | Today |
|-------|-------|
| Frontend | Next.js 15 (App Router), React 19, TS, Tailwind v4, React Flow v12 |
| State | Zustand + `persist` to **localStorage** (`lattice-canvas-v1`, `lattice-workspace`) + zundo undo |
| AI | `/api/ai` proxy → OpenRouter, **per-request, synchronous**, modes: summarize/ask/write/edit/batch/diagram/explore/angles/triage/gaps |
| Sources | `/api/openalex` (primary) + arxiv + semantic-scholar + wikipedia + pdf + readable |
| Nodes | Sources (agentic scout), Paper, Media (upload), Synthesize, Draft, Assistant, Note, Text, Group |
| Accounts | **None** |
| Database | **None** (browser only) |
| Background work | **None** (only runs while the tab is open) |
| Personalization | **None** |

**What is genuinely good:** the Sources node already does agentic discovery
(plan angles → route per-source → search → AI triage/score/cluster → curate →
gaps), papers/figures pop out as nodes, and the canvas is the right cockpit.

**What is missing for the vision:** everything that needs a *server brain* —
persistence per user, work that runs without the tab open, an index for
semantic/figure retrieval, and a personalization corpus.

---

## 3. Gap analysis

| Vision feature | Missing capability | Class |
|----------------|--------------------|-------|
| Work "while you sleep" | Accounts + DB + **durable job runtime** running agent loops server-side | Infra |
| Find papers "AI couldn't" / reverse search | **Embeddings index** (text + image/CLIP) in a vector store + ingestion | Infra |
| Agents "trained on you" | **Corpus ingestion + style-profile pipeline**; an **Agents surface** | Product + Infra |
| Distinct agents (scout / writer / citationist) | A shared **Agent abstraction** (config, tools, knowledge) | Product |
| Compose full paper | Orchestration over trained writer + sources + **citation verification** | Product |
| Anything per-user / cross-device | Server persistence (replace localStorage) | Infra |

Three of the six are **infrastructure** the app does not have. That is the real
distance — not more canvas UI.

---

## 4. Target architecture

```
                         ┌─────────────────────────────────────────┐
                         │                 Client                   │
                         │  Canvas (React Flow)   Agents surface     │
                         │  nodes ⇄ live updates  (configure/train)  │
                         └───────────────┬───────────────────────────┘
                                         │  HTTPS / Realtime
                         ┌───────────────▼───────────────────────────┐
                         │              App server (Next.js)          │
                         │  /api/ai   /api/agents   /api/search …      │
                         └───┬───────────┬───────────────┬────────────┘
                             │           │               │
              ┌──────────────▼──┐ ┌──────▼────────┐ ┌────▼─────────────┐
              │  Database +Auth  │ │ Agent runtime │ │ Retrieval / index │
              │  (Postgres,      │ │ + Job system  │ │ (pgvector:        │
              │   pgvector,      │ │ (durable,     │ │  text + CLIP image│
              │   Storage,       │ │  scheduled    │ │  embeddings)      │
              │   Realtime)      │ │  agent loops) │ │                   │
              └──────────────────┘ └───────┬───────┘ └────┬──────────────┘
                                           │              │
                                  ┌────────▼──────────────▼─────────┐
                                  │ External: OpenRouter (LLMs),     │
                                  │ OpenAlex/arXiv/S2/PMC/Open-i,    │
                                  │ embeddings + CLIP providers      │
                                  └──────────────────────────────────┘
```

### 4.1 Data model (core entities)
- **User** — auth identity.
- **Project** — a research workspace (replaces the localStorage workspace).
- **CanvasDoc** — nodes + edges + per-node data (server-persisted; localStorage
  becomes a cache, not the source of truth).
- **Source** — a paper/figure record (title, authors, year, abstract, ids/DOI,
  url, embeddings ref). Deduped per user.
- **Figure / Media** — image + caption + alt + credit + parent source + CLIP
  embedding.
- **Agent** — `{id, owner, name, role, systemPrompt, tools[], knowledgeRefs[],
  config (citationStyle, dialect, model), trainedFrom (corpus refs)}`.
- **Corpus** — the user's own writings (uploaded papers) → chunks + embeddings +
  a derived **StyleProfile**.
- **StyleProfile** — structured "how I write" card: voice descriptors, argument
  patterns, lexical signature, citation conventions, exemplar passages.
- **StandingTask** — a background job: `{topic, agent, schedule, filters,
  dedupAgainst}`.
- **Run / Finding** — outputs of a task run; findings dedupe against the user's
  known set; surfaced as a digest.

### 4.2 The Agent abstraction (shared across surfaces)
One model, two execution modes:
- **Interactive** — drives a Canvas node (Sources/Synthesize/Draft already are
  proto-agents; generalize them to read an `Agent` config).
- **Headless** — runs in the job runtime for background tasks.

Built-in archetypes:
- **Scout** — relevance + **counter-source** retrieval (deliberately seeks
  disconfirming work), the current Sources logic generalized.
- **Synthesizer** — claims → evidence → citations over the curated keep-set.
- **Stylist (your writer)** — drafts in your dialect using the StyleProfile.
- **Citationist** — enforces a citation convention + verifies each reference
  exists (against OpenAlex/Crossref).

### 4.3 Personalization ("trained on you")
Pragmatic path (no fine-tuning required to start):
1. **Ingest** past papers (PDF/DOCX) → chunk + embed → Corpus.
2. **Analyze** with an LLM pass → a structured **StyleProfile** (voice, argument
   moves, hedging level, citation style) + selected exemplar passages.
3. **Apply** — the Stylist agent's prompt = StyleProfile + retrieved exemplars +
   the curated sources. RAG + exemplars reaches ~80% of "sounds like me."
4. **Optional later** — LoRA/fine-tune for the last mile.

### 4.4 Background runs ("while you sleep")
- A **StandingTask** is defined in Canvas/Agents surface.
- The **job runtime** executes the agent loop on a schedule/continuously:
  search → screen → **dedupe against the user's known corpus + prior finds** →
  store findings.
- On wake, the user gets a **digest** (a "new finds" inbox/node) + notification.
- Hard requirement: durable, retryable, scheduled jobs — not browser timers.

### 4.5 Retrieval / reverse search
- **Text recall beyond keywords:** embed sources + queries → semantic search in
  pgvector, surfacing papers keyword search misses.
- **Figure / reverse search:** CLIP-embed figures (from open-access papers +
  uploads); query by image (reverse) or text. This is the "thousands of figures"
  capability — an index you ingest into, not a live API call.

---

## 5. Tech choices (pragmatic, minimize moving parts)

| Need | Choice | Why |
|------|--------|-----|
| DB + Auth + Storage + Vector + Realtime | **Supabase** (Postgres, Auth, Storage, pgvector, Realtime) | One platform covers persistence, accounts, file storage (media/PDF/corpus), the vector index, and live updates for background runs |
| Durable background jobs | **Inngest** or **Trigger.dev** | Multi-step, retryable, scheduled agent loops — the "while you sleep" engine |
| Agent orchestration | Server-side **tool-use loop** (Anthropic-style) via the existing OpenRouter boundary | Reuse `/api/ai`; add a tool-calling loop for multi-step agents |
| Text embeddings | Voyage / OpenAI / Cohere (provider-agnostic) | Cheap, strong recall |
| Image embeddings | **CLIP** via a hosted runner (fal/Replicate) | Figure reverse search |
| Notifications | Supabase Realtime + email/web-push | "Done while you slept" |

> These are recommendations, not commitments — each is revisited at its phase.

---

## 6. Phased roadmap

Each phase ends in something usable; later phases depend on earlier infra.

**Phase 0 — Deepen Canvas (no infra) — DONE (2026-06-26)**
- [x] **TipTap editor foundation** — real rich-text Draft (inline node + full
  surface share one doc); citations are first-class inline marks; migration-safe.
- [x] **Synthesize → structured** — `synth` mode returns claims (claim →
  evidence → source) + contradictions + themes over the connected sources.
- [x] **Johns (Citationist) — citation audit** — `audit` mode flags each draft
  claim supported / weak / unsupported against the connected sources (Audit tab).
  Existence-lookup vs OpenAlex/Crossref is a later Citationist refinement.
- [x] **Lily (Stylist) — write in your voice** — `dna` mode derives an
  account-level style profile (pasted text or uploaded paper) that conditions
  the writer. Pulled forward from Phase 3; RAG/exemplars + fine-tune still later.
- [ ] **Vision on Media** — connect a figure to Synthesize/Assistant. The one
  Phase-0 item still open.
- Plus shipped: hand tool + connection management, account-wide Readroom, Link
  node, full-page doc editor. Auth (Supabase) is wired (login/proxy/RLS-ready).

**Phase 1 — Backend foundation (the unlock) — CODE-COMPLETE (2026-07-04)**
- Supabase: Auth + Postgres wired. Workspace metadata (projects/canvases/
  pinned/styleProfile/interests) syncs via MERGE (local-only kept + pushed up,
  newer `updatedAt` wins — never blind-replace; `src/lib/sync/merge-workspace.ts`).
  Boards: localStorage authoritative, write-through to DB, **read-on-miss**
  for cross-device (`src/lib/board-lifecycle.ts` — local always wins when
  present; DB fills a local miss only; blob validated at the boundary).
- Board loading is ONE function: `loadBoard()` — used by /canvas, /doc, shell.
- Regression suite: `pnpm test` (Playwright — canvas isolation, doc
  persistence, node select/drag, merge + blob-validation unit tests).
- Remaining operational step: apply `supabase/schema.sql` to the project
  (drop old uuid-PK tables first if present), then a two-device smoke test.
- Exit: multi-device, per-user persistence. **Plan: `docs/BACKEND-PHASE1.md`.**

**Phase 2 — Agent abstraction + Agents surface — FOUNDATION DONE (2026-07-08, commit 09479c7)**
- [x] `Agent` model (`src/lib/agents.ts`) + persisted agent library
  (`src/store/agent-store.ts`) seeded with 5 built-in archetypes (Scout,
  Synthesizer, Stylist, Citationist, Research Assistant); custom-agent CRUD;
  built-ins editable + resettable, not deletable.
- [x] Real `/agents` management surface (configure name/model/system prompt/
  citation style; create/edit/delete/reset).
- [x] Node binding via a reusable `AgentPicker` + `useNodeAgent` (node
  `data.agentId`, defaults to archetype). Bound so far: **Assistant**,
  **Sources→Scout** (angles/triage/gaps), **Synthesize→Synthesizer**. Persona
  threaded through `ai-client` → `/api/ai` (prepended to mode instructions).
- [ ] Bind the last two: **Draft→Stylist** + **audit→Citationist** (both live
  in the writing surface).
- [ ] Sync agents to Supabase (localStorage-only today; mirror
  `use-workspace-sync`).
- Exit (met for the Assistant path): you pick which agent a node uses; agents
  are first-class.

**Phase 3 — Personalization**
- Corpus upload → embeddings → StyleProfile pipeline. Stylist agent writes in
  your voice.
- Exit: Draft "sounds like me."

**Phase 4 — Background autonomous runs**
- Job runtime + StandingTask + Findings digest + notifications.
- Exit: define a standing search; wake up to new, deduped finds.

**Phase 5 — Semantic + figure/reverse index**
- pgvector text index; CLIP figure index; ingestion pipeline.
- Exit: "find papers AI missed" and reverse-image figure search.

**Phase 6 — Full paper composition**
- Orchestrate Stylist + curated sources + synthesis + Citationist → a complete
  drafted paper with verified citations and export.
- Exit: the headline promise.

---

## 7. Risks, cost, open decisions
- **Scope/infra leap at Phase 1** — committing to a backend changes the project
  from a client app to a service (ops, auth, cost, privacy). Decide deliberately.
- **Cost of background runs** — continuous agent loops over many papers are the
  main spend; needs budgets/quotas per user and dedup to avoid re-work.
- **Privacy** — the user's corpus (their unpublished writing) is sensitive;
  storage, isolation, and deletion must be first-class.
- **"Trained" expectation** — set expectations: RAG + style-exemplars first;
  fine-tuning is a later, optional upgrade.
- **Reverse/figure index quality** — CLIP recall is good but not magic; frame as
  "surfaces more than keyword search," not "finds everything."
- **Open question:** does the "other page" (Agents) also host the corpus/training
  UI, or is that a separate "Profile/Training" surface?

---

## 8. What stays the same
The Canvas we have built — Sources, Paper, Media, Synthesize, Draft, Assistant —
is the correct front end for all of the above. Nodes are exactly what trained and
background agents will *operate*. The work ahead is the **server brain** behind
the cockpit, not a redesign of the cockpit.
