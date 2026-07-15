# Canvas Research Assistant — Feature Specification & Vision

**Product**: AI-Powered Research Canvas
**AI Engine**: Claude (Anthropic)
**Status**: Pre-Development Briefing
**Version**: 0.1 — Initial Draft

> Canonical product vision. For implementation status against this spec, see
> [../ROADMAP.md](../ROADMAP.md). Note: model IDs below are illustrative —
> use current IDs (claude-haiku-4-5, claude-sonnet-4-6, claude-opus-4-8).

---

## Product Vision

A spatial, node-based workspace where researchers, writers, and analysts can
gather sources, process them with AI, and synthesize knowledge into structured
output — all within a single infinite canvas. The canvas is not just a board;
it is an **active thinking environment** where AI participates in the research
process, not just reacts to it.

## Core Interaction Principles

- **Zero-friction capture**: Anything pasted onto the canvas becomes something
  useful immediately — no menus, no dialogs.
- **Everything is a node**: Content, tools, AI computations, and connections are
  all first-class canvas citizens.
- **AI is ambient**: Claude runs in the background, reading what's on the canvas
  and offering computation without interrupting the user's flow.
- **Spatial = semantic**: Proximity, stacking, and connections between nodes
  carry meaning the AI can interpret.

## Node Catalog (summary)

1. **Browser Node** — paste a URL → spawns a sandboxed page viewport (scroll,
   click, select, resize, full-screen). Header: favicon/URL, refresh, full
   screen, collapse, pin, delete. Extensions: snapshot versioning, auto-highlight
   clip, cite button.
1.1 **AI Compute Node (Browser → Text)** — Web→Markdown / Plain Text / Summary /
   Key Points / Citation / Q&A. Chain mode, multi-source synthesis, table extractor.
2. **Text Node** — paste text → content-first editable node; smart paste
   detection (URL→Browser, MD→rendered, JSON/CSV→Data, image→Image); color tags;
   inline AI; source backlink.
3. **File Node → Text pipeline** — pdf/docx/txt/md/csv/xlsx/png/jpg/mp3/mp4;
   two-stage (File Node preserved, Extract → Text Node). Folder drop, live sync,
   structure split.
4. **Stack Node** — group many nodes; AI ops: Synthesize / Compare / Outline /
   Bibliography / Gap Analysis / Smart Write. Relevance scoring, pinning, smart sort.
5. **Research Question Node** — semantic anchor; grounds all AI ops; Gap Map.
6. **Writing Node** — live rich-text editor fed by stacks/nodes; ghost text,
   citation insertion, section expansion, structural suggestions.

## Clipboard & Paste Intelligence (Global)

Intercept Cmd+V globally and route by type: URL→Browser Node, text→Text Node,
DOI/arXiv→Academic Paper Node, YouTube→Video Node, social→Quote Node,
GitHub→Code Node.

## Canvas-Level AI

- **Canvas Chat** sidebar — Claude sees all nodes; can answer across the canvas
  and create nodes from chat.
- **Auto-Clustering** — suggests groupings.
- **Citation Mode** — numbered citation badges; export bibliography.

## Export

Markdown · PDF · Word (.docx) · Bibliography (APA/MLA/BibTeX) · JSON (full state).

## Technical Architecture (Claude)

- **Context**: each AI Compute Node sends only its connected source; Stack ops
  send all stack nodes; Canvas Chat gets a canvas summary + connected nodes.
- **Models**: Haiku for extraction/ghost-text; Sonnet for Q&A; extended-thinking
  Sonnet/Opus for synthesis. (Use current model IDs.)
- **Rate/UX**: visible "Computing…" state, queue requests, cache per node,
  recompute on change/explicit request.

## Open Questions

1. Persistence: server-side vs local? 2. Collaboration: multi-user? 3. Browser
Node security: iframe vs server-side screenshot+DOM (CSP/CORS blocks raw iframes).
4. Mobile: desktop-only initially? 5. Offline mode? 6. Auth & workspaces?

## Build Phases

- **Phase 1 — Core Canvas (MVP)**: infinite canvas, smart paste, Browser Node,
  Text Node, AI Compute Node (Web→MD/Summary/Key Points), node connections.
- **Phase 2 — Files & Stacks**: file drag-drop, PDF/DOCX extraction, Stack Node,
  Stack AI ops.
- **Phase 3 — Smart Writing**: Writing Node, Research Question Node, Canvas Chat,
  citation mode + bibliography export.
- **Phase 4 — Intelligence Layer**: auto-clustering, DOI/arXiv/YouTube paste,
  relevance scoring, gap analysis, export (MD/DOCX/PDF).

---

*Document prepared for Clue One Digital GmbH — Research Canvas Product Initiative*
