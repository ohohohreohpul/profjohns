# Plan — Discover Polish (C) + "For You" Personalization (A)

> Dev-team brief. Builds on the current Perplexity-style home: left sidebar +
> central research hero + Discover feed. Today the feed is **Phase 1** —
> interest tabs querying keyless **OpenAlex** (`/api/openalex?q=…&sort=date`),
> **no AI/credits**. The hero launches a seeded research canvas.
> Files of note: `src/components/home/discover-home.tsx`, `src/app/api/openalex/route.ts`,
> `src/store/workspace-store.ts`, `src/components/canvas/nodes/explorer-node.tsx` (the scout).

---

## Track C — Discover polish + hero connectors

**Goal:** make the feed feel premium and make the hero's `@` (sources/connectors) actually scope the research.

### C1 · Feed controls (quick win)
- Add **sort** (Recent / Most-cited) and **time range** (1y / 5y / all) to the Discover header.
- OpenAlex already supports `sort=date|cited`; add `from_publication_date` to `/api/openalex` for time range.
- Cache each tab's results in `sessionStorage` (key by interest+sort+range) to cut repeat calls / rate limits.
- States: skeletons (exist), empty, error+retry.
- **Done when:** sort + range change the feed; revisiting a tab is instant from cache.

### C2 · `@` sources / connectors popover (the headline)
- Typing `@` in the hero opens a popover listing **source providers** (OpenAlex, arXiv, Semantic Scholar, Wikipedia) and, later, **connectors** (Zotero, etc.).
- Selected sources become **chips** in the hero and are passed to the launched canvas (`/canvas?…&sources=openalex,arxiv`); the **Sources scout** reads them to constrain provider routing instead of letting the AI pick.
- **Routing shape (verified — low risk):** the scout is NOT a tool-call loop. The `angles` AI mode returns JSON where each angle carries a `source: SourceProvider`; `proposeSearchAngles` already clamps it (`ALLOWED_SOURCES.includes(a.source) ? a.source : "openalex"`) and `runSearch` calls `searchProvider(source, query)`. So C2 = **narrow the allow-list to the selected providers** (clamp non-allowed → first selected) and optionally pass the allowed set into the angles prompt. No routing-layer rewrite.
- New component: `HeroSourcesPopover`. Scout change: `explorer-node` reads an allowed-sources set (from URL param / node data) and passes it to `proposeSearchAngles`.
- **Done when:** `@` → pick providers → launched scout only searches those.

### C3 · Card polish
- Richer cards: **open-access badge**, **citation count**, venue; hover lift; a **"Save to Space"** action (pick/create a project, pin the source) in addition to "Research this".
- Optional: figure thumbnail when available (defer to the Media/Open-i work).
- **Done when:** cards show OA + citations and can be saved into a Space.

### C4 · Editable interests
- Let users add/remove interest tabs (a topic picker). Persist as `homeInterests: string[]` in `workspace-store` (mirrors `homeOrder`/`homeHidden`).
- **Done when:** interests persist across reloads and drive the tabs.

**Track C effort:** ~3–5 dev-days. Sequence: C1 → C2 → C4 → C3.

---

## Track A — "For You" personalization (Discover Phase 2)

**Goal:** a feed trained on the user's own library + projects — **without draining credits by default**. Two sub-phases.

### Data model
- **Interest profile** (client now; server in VISION P1): `{ keywords: {term, weight}[], conceptIds: {id, weight}[], updatedAt }`.
- Signals (all local, no AI): **kept sources** (titles, abstracts, venues, OpenAlex `concepts[]`), **project directions**, **draft text**, **scout topics**.
- **Persist in a dedicated `profile-store`** (DECIDED — not `workspace-store`). The profile grows (keywords + concept weights + recency + feedback), so keeping it separate keeps `workspace-store` lean and makes the VISION-P1 server migration a clean 1:1 move (its own table/endpoint). Same zustand+persist pattern.

### A1 · Profile builder + concept capture (no LLM) — Phase 2a
- **Includes the ingestion change (part of DoD, not a side note):** capture OpenAlex `concepts[]` (id + display_name) at keep-time — extend the OpenAlex mapping (`/api/openalex`) and the kept-source payload (`setNodeSources`) so A2-by-concept has data. Without this, A2 silently degrades to keyword-only.
- `buildInterestProfile()` util: tally concept ids + keywords (titles/topics/venues) across kept sources + project directions; weight by frequency + recency.
- **Done when:** (1) kept sources persist their OpenAlex concept ids, AND (2) a weighted profile object is derivable from existing workspace data.

### A2 · "For You" feed (no LLM)
- Add a leading **"For You"** Discover tab. Query OpenAlex by the profile's top **concept ids** (`filter=concepts.id:…&sort=date`) or keywords; dedupe vs already-seen.
- Fallback to the static interest tabs when the profile is empty (new users).
- **Done when:** with kept sources/projects present, "For You" shows relevant recent work derived from the corpus — zero AI calls.

### A3 · Feedback loop
- Per-card **More / Less like this** (or thumbs); adjusts concept/keyword weights; persisted.
- **Done when:** feedback measurably shifts subsequent results.

### A4 · Opt-in deep refine (LLM) — Phase 2b
- A **"Improve my feed"** button: one AI pass clusters the corpus into themes + query expansions; **cache** the result; only re-run on demand.
- Gate behind an explicit action with a **visible credit estimate** (no background spend).
- **Credit estimate spec (concrete):** the codebase already has an *illustrative* model — `models.ts` `creditsPerRun` per model, `creditsUsed`/`spendCredits` in `canvas-store`, surfaced as "~N credits (est.)" in the top bar. The refine button shows, before running, a badge **"Uses ~N credits"** where `N = expectedCalls × getModel(modelId).creditsPerRun` (refine is a single pass → `expectedCalls = 1`, so `N = creditsPerRun`). On confirm, call `spendCredits(N)`. Keep the "~" + "(est.)" framing — it is a hint, not billing. (If/when real billing arrives in VISION P1, swap the source of truth behind the same badge.)
- **Done when:** the badge shows the estimate up-front; refine runs only on click; `creditsUsed` increments by the shown amount.

### A5 · Privacy
- Profile is derived **locally** until the backend lands; the user's corpus (esp. drafts) is sensitive. With VISION P1, store per-user, isolated, deletable.

**Track A effort:** ~5–8 dev-days (2a cheap & deterministic; 2b more). Benefits from VISION Phase 1 (accounts/DB) for cross-device + scale, but a client-only v1 works.

---

## Recommended sequence
1. **C1 + C2** — sort/range + the `@`-sources popover (visible wins, scopes research).
2. **C4** — editable interests.
3. **A1 → A2** — "For You" (no-LLM) — the core personalization.
4. **A3** feedback, then **A4** opt-in refine.
5. **C3** card polish (pairs with the Media/Open-i figure work).

## Cross-cutting risks
- **OpenAlex rate limits** → throttle, `sessionStorage` cache, keep the polite `mailto`.
- **Credit drain** → A is no-LLM by default; LLM only on explicit "Improve my feed" with the up-front estimate badge (A4).
- ~~Scout routing for C2~~ **RESOLVED** — verified the scout routes via an AI-tagged `source` per angle + client clamp, not tool calls; C2 is an allow-list narrowing.
- ~~Concept capture as a separate slip~~ **Folded into A1's DoD** — the OpenAlex `concepts[]` ingestion change ships with A1; keyword-only remains the automatic fallback if a source lacks concepts.
- **Backend dependency** → personalization is best per-user/server-side (VISION P1); ship a client-only v1 first, migrate later. The dedicated `profile-store` makes that migration 1:1.
