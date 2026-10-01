# ProfJohns — Rebuild Spec (v2)

Status: approved 2026-10-01 — walls of cards; light default with dark built in;
existing boards converted (old kept until confirmed). Supersedes the node model in REDESIGN.md;
keeps its "calm-precise" mood.

## 0. Why rebuild

Measured, not assumed. A Jev-judged PhD-student journey ("Maya") on the live
site scored most steps 0.3–0.5 on "knows what to do next" and flagged the board
as "broken or empty" once it held a few nodes. Root causes, from screenshots:

1. **Wires as the data model.** Papers only reach Synthesize or the Draft when
   a connection is dragged between them. Users must learn a pipe graph, and the
   board turns into crossing lines.
2. **Fat nodes.** The Sources node grows to 840px with angles, results, scores,
   and notices inside; Synthesize lists every claim inline.
3. **Knowledge has no home.** What you learn while reading (Reader highlights,
   Synthesize claims, the unused `extracts` store) never becomes a reusable,
   citable object.
4. **Local-first plumbing.** One in-memory store swapped between boards,
   localStorage as the truth, DB as a backup — the source of the cross-board
   leaks we kept fixing.

Benchmark: Storyflow (creative/UX teams) — titled columns ("walls") of cards on
an infinite canvas, a prompt box that acts on attached cards, AI output landing
as cards, calm dark surfaces with one accent. We copy the interaction grammar,
not the domain.

## 1. Our DNA — what Storyflow does not do

Every rebuild decision must protect these:

- **One research question** anchors the board; every AI step reads it.
- **Evidence is verbatim.** Quotes are sentences selected from the paper's own
  text (Jev "select, don't generate"), never written by a model.
- **Every insight cites a paragraph**, not just a paper.
- **References are verified** against OpenAlex/Crossref before export.
- **Output is a paper**: outline, sections, references, DOCX/LaTeX/BibTeX.

## 2. The board: walls of cards, not wires

An infinite canvas (kept) organised into **walls**: titled columns that mean a
stage of research. A card's wall *is* its role, so data flows by placement, not
by wires. Default research template, left to right:

| Wall | Holds | Replaces |
|---|---|---|
| **Question** | The research question card (+ sub-questions) | onboarding "direction" |
| **Sources** | Search bar + incoming Paper cards (New / Kept) | Explorer node, Watch page |
| **Reading** | Papers you are studying (open one = Study panel) | Paper node + Reader surface |
| **Insights** | Insight cards (typed, quoted, cited) | Synthesize claims, `extracts` |
| **Themes** | Theme cards clustering insights | Synthesize node |
| **Draft** | The paper (the one big card); outline = Themes | Writing node |

- Drag a card between walls to change its stage (Kept paper → Reading).
- Wires remain only as optional *explicit* links ("contradicts", "extends").
- Users can add custom walls; walls collapse; Tidy is no longer needed.

## 3. Cards (small, uniform, typed)

All cards share one chrome: type chip + accent edge, title, 2–3 line body,
footer meta. Detail opens in a side panel (never inside the card).

- **Paper** — title, authors·year·venue, relevance score, status (New/Kept).
- **Insight** — type (claim · method · finding · limitation · gap · definition
  · quote), one-sentence statement, verbatim quote, citation (paper + para).
- **Theme** — name, support strength (n insights, n papers), contradiction flag.
- **Note** — free text (merges today's Note + Text).
- **Question** — the research question.
- **Draft** — the document; sections mirror Theme cards.

## 4. Study panel (the heart)

Open a Paper in Reading → right panel:

1. **For your question** — 3-line relevance summary grounded in full text.
2. **Proposed insights** — candidate sentences selected by Jev from the text,
   each typed; Accept / Edit / Reject. Accepted → Insight card in Insights.
3. **Ask & be asked** — grounded Q&A with paragraph refs, plus Socratic
   prompts ("Does this effect size transfer to your setting?").
4. **Full text** with highlights; highlighting a passage offers "Make insight".

## 5. Prompt bar (AI on what you select)

A bottom prompt bar, Storyflow-style: select cards (or @mention them), type a
request. Academic actions as presets: "Compare these papers", "Find gaps",
"Build a literature matrix", "Outline from themes", "Draft section".
Results land as cards in the right wall. Replaces the Assistant node.

## 6. Live Sources

The Sources wall keeps searching (daily, and on open): re-runs angles, adds
"More like these" from OpenAlex related/cited works, dedupes, Jev-ranks.
New papers arrive with a New badge. Replaces the separate Watch page.

## 7. Infrastructure

- **Server is the truth.** Supabase tables: `projects`, `boards`, `walls`,
  `cards` (typed JSON payload), `links`. Local storage is a cache only. No
  board blob swapping; each board loads its own rows.
- **Cards are rows** → insights are queryable across a project (literature
  matrix, retrieval for drafting, "where did I read that?").
- One API boundary per domain (`/api/papers`, `/api/study`, `/api/insights`)
  with the existing envelope; Jev for typed judgments, LLM for prose.
- Keep: auth, Stripe billing, legal pages, OpenAlex search fixes, keep policy,
  Jev client, citation formatting, export.

## 8. Design system

- Tokens first (DTCG → CSS vars), light + dark from day one; one blue accent
  for primary actions, semantic accent per card type, neutral surfaces.
- Type: grotesk UI, editorial serif for paper/draft text.
- Motion: tokenised 120–240ms; cards fade+lift on arrival; reduced-motion
  parity. Never animate transforms on elements that React Flow measures.
- Gates per phase: contrast/state checks, no-emoji, responsive, Jev journey.

## 9. Erase list

Explorer node UI · Synthesize/processor node · Assistant node · Shell/Group
(→ walls) · Text node (→ Note) · drag-to-connect as data flow · Tidy up ·
Watch page (→ live Sources) · Readroom surface (→ Study panel) ·
`extracts` store · board-blob persistence.

## 10. Phases (each ships to production and re-runs Maya)

| # | Phase | Done when |
|---|---|---|
| 1 | Tokens, app shell, server data model (projects/boards/walls/cards) | New board loads from Supabase, no local truth |
| 2 | Walls + Paper/Note/Question cards; Sources wall search | Maya finds and keeps papers without wiring |
| 3 | Study panel + Insight cards (Jev-selected quotes) | Accepted insights carry verbatim quote + para |
| 4 | Themes + Draft outline from themes + cited compose | Draft section cites insights end to end |
| 5 | Prompt bar presets + live Sources | "Compare these" lands cards; New papers arrive |
| 6 | Literature matrix, reference verification, export | DOCX/BibTeX export passes verification |

Migration: existing boards are converted once (nodes → cards by kind; kept
sources → Paper cards in Sources; drafts → Draft card). Nothing is deleted
until the converted board is confirmed.
