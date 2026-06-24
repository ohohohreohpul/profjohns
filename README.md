# ProfJohns — node-based research canvas

A canvas for academic / paper research. Start from a research direction, then
work on an infinite canvas of connected nodes: pull sources, extract and read,
review in a gallery with an always-on agent, and write — routing each action
through the AI model of your choice with a live credit estimate.

> This is the **UI prototype** stage. AI calls, source providers, extraction,
> credit metering, and persistence are mocked. The interaction model and design
> language are real.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn-style** primitives (hand-rolled, monochrome)
- **React Flow** (`@xyflow/react`) for the canvas
- **Zustand** for canvas state
- **lucide-react** icons

## Run

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # production build
```

> `next dev` and `next build` share the `.next/` folder. If you run a build
> while a dev server is/was running, dev can start serving stale chunks (404s,
> no hydration). If that happens: `rm -rf .next && pnpm dev`.

## Flow

1. **`/`** — research-direction prompt → "setting up your space" preloader.
2. **`/canvas`** — seeded with a Sources node wired into the primary Writing
   node. From there:
   - **Floating left toolbar** drops any node onto the canvas.
   - **Drag a connection** off any node's right handle onto empty canvas to open
     a contextual menu of sensible next nodes, then connect automatically.
   - Each node has a **model picker** (Claude / Gemini / OpenAI) showing the
     **credit cost** per run. Top bar tracks total credits used.
   - **Primary nodes expand** to a full-screen surface (⤢ in the node header):
     - **Writing surface** — connected-sources rail with numbered citations, a
       real block editor (editable title; heading/paragraph blocks; Enter adds a
       block, Backspace on an empty block removes it; hover gutter toggles block
       type), and an AI-assist rail whose actions append real content and show
       live credit cost (scaled by the node's selected model). Documents persist
       in the store across closing/reopening the surface.
     - **Review surface** — Gallery / Pages toggle plus an always-on agent rail
       that flags "where to read first"; jumping to a passage opens the page
       reader with the anchor highlighted.

## Node types

| Node | Role |
|------|------|
| **Sources** | **Live** search of arXiv & Semantic Scholar + PDF upload/extraction. Origin node. |
| **Extract & Read** | Full text, quick-read summaries, key claims per source. (UI; AI mocked.) |
| **Data viz** | **Live** monochrome chart of your sources by publication year. |
| **Writing** | *Primary.* Block editor with citations, style presets, and export. |
| **Review** | *Primary.* Gallery / multi-page review with an always-on reading agent that anchors where to read. |

## What actually works (no AI key needed)

- **Real source search** — arXiv (`/api/arxiv`) and Semantic Scholar
  (`/api/semantic-scholar`, optional `SEMANTIC_SCHOLAR_API_KEY` to avoid rate
  limits), plus PDF upload + text extraction (`/api/pdf`, via `unpdf`).
- **Persistence** — canvas, documents, sources, citations, and style survive
  reloads (localStorage).
- **Citations & standards** — cite a source into the draft (in-text mark +
  live references list), switch between APA / IEEE / Nature / MLA.
- **Export** — Markdown, LaTeX, plain text, and real `.docx` (lazy `docx`),
  references included.
- **Data viz** — sources charted by year.

AI-dependent features (citation audit, humanization, writing-DNA, background
agents) are deferred until an API key is wired — see [ROADMAP.md](ROADMAP.md).

## Project layout

```
src/
├── app/
│   ├── page.tsx              # onboarding (prompt + preloader)
│   ├── canvas/page.tsx       # canvas workspace
│   └── globals.css           # monochrome design tokens + RF overrides
├── components/
│   ├── ui/                   # shadcn-style primitives
│   ├── onboarding/           # research prompt, preloader
│   └── canvas/
│       ├── research-canvas.tsx   # React Flow wiring + spawn logic
│       ├── toolbar.tsx           # floating left toolbar
│       ├── model-picker.tsx      # model + credit picker
│       ├── connection-menu.tsx   # drag-from-edge spawn menu
│       ├── top-bar.tsx
│       ├── nodes/                # source / extract / writing / review
│       └── edges/                # action edge
├── lib/                      # models, node catalog, mock data, utils
└── store/                    # zustand canvas store
```

## Design language

Black & white, flat, no gradients. One ink color over layered greys on
paper-white surfaces; hierarchy comes from scale and weight. Primary nodes
(Writing, Review) carry an ink border to stand out from utility nodes.

## Next steps (not yet built)

- Real source providers + PDF extraction
- Real model routing (Anthropic / Google / OpenAI) and credit accounting
- Persistence + multiplayer (the Invite/Share affordances are stubs; the editor
  persists only in-memory for the session)
- Rich text within blocks (bold/italic/links) and real inline citations
- Wire the Review agent anchors to real extracted page content
