# ProfJohns — Redesign Direction (v1)

Audit-first reset of concept, nodes, workflow, and visual system. Decide here,
then apply (tokens → type/space → components → motion) per the `redesign` skill.

## 1. Brief inference (the foundation)
- **Domain**: academic / knowledge research workspace.
- **Audience**: researchers, grad students, analysts, writers. Literate, busy,
  allergic to toy-feeling tools.
- **One mood adjective the result must earn**: **calm-precise** (a quiet, premium
  instrument — not playful, not sci-fi).
- **Motion depth**: restrained & functional (clarify flow; never decorate).
- **Layout family**: spatial canvas + focused side panels (no full-screen takeovers).

## 2. Why it feels weird today (diagnosis)
1. **Abstract node names** — Explorer / Processor / Block / Shell speak *dev*, not
   *research*. Nothing is self-evident.
2. **No visual identity** — every node is the same grey-on-white card; the board
   reads as noise. (Violates our own "no safe gray-on-white" rule.)
3. **Full-screen surfaces** — Reader/Writing/Review take over the screen and break
   the "one canvas" promise.
4. **Dormant AI** — without a key most nodes show "not configured," so the tool
   feels half-broken.

## 3. Concept rewrite
**"A canvas where your research thinks with you."** You drop in questions and
sources; the canvas reads them, helps you read and synthesize, and you write the
result — all in one spatial environment. Same core loop, but every node is named
for a **research task**, carries a **visual identity**, and does its work **in
place** (inline + side panel), not in modal takeovers.

## 4. Node taxonomy — research-anchored (old → new)
| New node | Role | Replaces |
|---|---|---|
| **Question** | The research question/thesis — the semantic anchor every AI op reads | (onboarding "direction", not a node before) |
| **Sources** | Find & gather: arXiv / Semantic Scholar / PDF / paste | explorer / finder |
| **Reader** | Read full text, highlight, ask | (surface only before) |
| **Note** | Your own writing/ideas — free text | block / text |
| **Synthesize** | AI across connected sources: themes, compare, gaps | processor |
| **Draft** | The document editor + AI writer + citations + export | writing |
| **Group** | Organize / frame related nodes | shell |
| **Assistant** | Canvas-wide chat that sees everything | assistant |

Each gets a **semantic accent** (icon chip + 2px top edge), neutral card body:
Question = ink, Sources = blue, Reader = amber, Note = slate, Synthesize =
violet, Draft = green, Group = neutral dashed, Assistant = ink. Restrained — one
accent per node, everything else stays calm neutral.

## 5. Workflow (the canonical loop, now legible)
**Question → Sources → (Reader to read/highlight) → Synthesize → Draft → Export.**
Connections carry data (already true). Make it feel runnable: each AI node has a
clear Run, a visible working state, and results land as connected nodes.

## 6. Visual direction (recommended archetype)
**"Linear-precision × editorial"** — the calm, premium, dark-capable feel of
Linear, with editorial serif display for documents. Concretely:
- **Color**: keep the neutral base; introduce ONE semantic accent per node type
  (above) + a single brand accent for primary actions. Add a real **dark theme**.
- **Depth**: soft elevation + hairline borders (not flat-flat); selected = accent ring.
- **Type**: a crisp grotesk for UI + an editorial serif for the Draft/Reader body.
- **Surfaces → panels**: Reader/Draft/Review open as a right-hand **panel** beside
  the canvas (canvas stays visible/dimmed), with an optional full-width toggle —
  not an automatic takeover.
- Tokens become the single source of truth (kit's `design-tokens`), every surface
  consumes them (single-theme consistency).

## 7. Apply plan (phased, behavior-preserving)
1. **Tokens & theme** — semantic token set (+ dark), node accent tokens.
2. **Node shell + identity** — restyle the shared node chrome; per-type accent/icon.
3. **Rename + remap** taxonomy (explorer→sources, processor→synthesize, etc.).
4. **Panel system** — convert surfaces from full-screen to side panel + toggle.
5. **Type & motion** — editorial body type; restrained motion pass.
6. **Verify** — `design-review`, `a11y-audit`, contrast + hardcode lint, smoke-test every flow.

> Open decision: confirm the archetype (Linear×editorial) or pick another
> (Notion-calm, dark-tech, brutalist-editorial), and whether dark theme is in v1.
