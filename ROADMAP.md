# ProfJohns — Product Roadmap

The vision: a node-based research canvas where you gather sources, read with an
always-on agent, write in your own voice, and audit citations — collaborating
with AI and (eventually) your own background research agents.

Status legend: ✅ done · 🟡 partial · ⬜ not started

## Now (in the build)

| # | Capability | Status | Notes |
|---|------------|--------|-------|
| — | Node canvas (toolbar + drag-from-edge) | ✅ | React Flow, 4 node types |
| — | Model picker w/ credit hints | ✅ | Claude / Gemini / OpenAI, illustrative credits |
| 2 | Keep sources visible | ✅ | Sources node + sources rail in Writing/Review |
| 4 | All nodes visible | ✅ | Canvas with fit-view, controls |
| 1 | Research multiple sources | 🟡 | **arXiv + Semantic Scholar live, PDF upload+extract live**. Add: web search |
| — | Writing surface (real editor) | ✅ | Block editor, persists to store |
| — | Review surface (gallery + agent) | ✅ | Anchors derived from real sources |
| 8 | Data visualization tool | 🟡 | **Viz node live** — papers-by-year chart from real sources. Add: more chart types, extracted tables |
| 9 | Export | ✅ | **md / LaTeX / .txt / .docx live** (real .docx via lazy `docx`). References included. Google Docs still TODO |
| 3 | Work on different citations | 🟡 | **Citation registry + in-text marks + live references list live.** Add: drag citations as canvas objects |
| 7 | Adhere to paper standards | 🟡 | **APA / IEEE / Nature / MLA presets live** (reformat references + in-text + export). Add: structure templates |
| — | Persistence | 🟡 | localStorage (canvas, docs, sources, citations, style). Next: accounts + cloud sync |

## Next (requested feature set)

| # | Capability | Status | Plan |
|---|------------|--------|------|
| 5 | Citation audit agent | ⬜ | A node/agent that checks every claim has a backing source + valid ref; flags orphans. Needs real AI. |
| 6 | AI humanization + recommendations | ⬜ | Rewrite passes; "make this sound like me" + suggestions. Needs real AI + #10. |
| 10 | Writing-DNA (upload past papers) | ⬜ | Upload corpus → derive a style profile → condition drafting/humanization on it |
| 11 | External connectors (Composio) | ⬜ | Statista, datasets, web research via Composio; surfaced as connector nodes |
| 9b | Google Docs export | ⬜ | Via Composio / Google API behind a server route |
| 1b | Web source provider | ⬜ | Another `/api/sources/*` route returning the shared PaperSource shape |
| 5/6 | Reader AI assistant (Summarize + Ask) | 🟡 | **Boundary built** at `/api/ai` (Anthropic, `claude-sonnet-4-6`). Reader has Assistant/Highlights tabs. Lights up when `ANTHROPIC_API_KEY` is set; graceful "not configured" message otherwise. |
| — | Real AI calls elsewhere + true credit accounting | ⬜ | Extend the `/api/ai` boundary to Extract/Writing/Review; meter credits off token usage |

## Runnable workflow (the core concept)

The tool is meant to be *usable modules + a runnable workflow*. Status:
- ✅ **Edges carry data (first instance)** — the **Find Sources** node reads
  text from connected upstream nodes (Note/Outline/etc.) via `getIncomers`, and
  a **Run** button executes the search on that wired-in query. This is the first
  node where a connection actually means something.
- ✅ **Connection-aware consumption** — `useNodeInputSources(nodeId)` walks the
  graph: source/finder/paper are producers, filter transforms, others pass
  through. Writing, Review, Filter, Data viz, references, and export now show
  ONLY papers wired into them (empty state when nothing is connected). Edges
  carry data.
- ⬜ **Per-node Run + run-state** for processing nodes (Extract etc.), and a
  **Run the whole graph** (topological) action.

## Node taxonomy

Nodes live (✅): **Find Sources · Sources · Extract · Filter · Data viz ·
Outline · Note · Group · Writing · Review**. Find Sources is the assistant: type
a topic and/or wire in a Note, then Run. Add nodes via the left toolbar, right-click on the
canvas, or by dragging a connection off a node.

Glue / bridge nodes shipped (no AI): **Filter** (narrow by year/citations/venue
over the source pool), **Outline** (editable section list → bridges to Writing),
**Note** (free-text), **Group** (resizable labeled frame, sits behind nodes).

Planned nodes:
- **Web / URL** and **Connector (Composio)** sources · **Dataset / CSV** (⬜, no AI)
- **Synthesis / Compare** — themes/comparison matrix across N sources. *Chosen as the first AI node.* (⬜, needs AI)
- **Q&A with sources** (RAG), **Citation Audit** (#5), **Humanizer** (#6),
  **Writing-DNA / Style Profile** (#10) (⬜, need AI)
- **Merge / Collect** to fan branches into one input; true edge-based data
  propagation so Filter/Group actually scope downstream consumers (⬜)

## Future pipeline

1. **Build-your-own background agent** — a "numbers digger" / researcher that
   reads 10–20+ papers continuously (incl. while you sleep), then you
   ping-pong with it in the morning. Needs: agent runtime, scheduling
   (cron/queue), durable per-agent memory, a chat surface on the canvas.
2. **AI reads your paper and rethinks it** — a critique/rethink agent over your
   own draft that proposes structural and argumentative revisions.

## Architecture notes for what's next

- **AI layer**: route all model calls through a single server boundary
  (`/api/ai/*`) so providers/keys swap cleanly and credits meter off real token
  usage. The action layer in the Writing/Review surfaces already isolates
  "actions" — wire them to this instead of canned content.
- **Sources**: `searchArxiv` is the template. Add sibling providers behind
  `/api/sources/<provider>` returning the same `PaperSource` shape.
- **Connectors (Composio)**: model as a provider family under `/api/connectors`
  with per-user auth; surface as connector nodes that emit `PaperSource`-like or
  dataset records.
- **Export**: pure-client for md/LaTeX from the block doc model; Google Docs via
  Composio/Google API behind a server route.
- **Background agents**: need persistence beyond localStorage (accounts +
  server store) and a job runner; out of scope for the client-only prototype.
