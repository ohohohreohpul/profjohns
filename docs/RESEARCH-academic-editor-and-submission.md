# Research — Document Editor & AI Submission Features for Academic Researchers

> Grounds the next phase of ProfJohns: turning a composed paper into a
> **submission-ready, venue-compliant, verifiably-cited manuscript** and getting
> it into a journal's submission portal. Companion to `VISION.md` (Phase 6
> refinements) and `SPEC.md`.
>
> Date: 2026-09-29. Sources are linked inline.

---

## 1. The loop we are closing

Researchers currently move through a fragmented chain:

```
discover → read → argue → draft → polish → format-to-venue → verify citations → submit
```

ProfJohns already covers the left half (discover → argue → draft, via canvas +
agents + Compose). The right half — **polish, format-to-venue, verify, submit** —
is where researchers "waste hours jumping between tools" and resort to manual
workarounds. That gap is the product opportunity. ([Researcher Campus](https://dev.to/jayeshthar/researcher-campus-an-ai-pipeline-that-replaces-5-research-tools-with-one-workflow-4c5o), [PainPointMap](https://www.painpointmap.com/blog/reddit-research-guide-saas-founders))

---

## 2. Document-editor features researchers need

Synthesized from the 2026 tool landscape ([Papers.ai](https://papers.ai/),
[ScriptOra](https://scriptora.ai/), [Bibby AI](https://arxiv.org/abs/2607.05435),
[Manuscript Markdown](https://github.com/jbearak/manuscript-markdown),
[Overleaf](https://www.overleaf.com), [Typst](https://typst.app)).

### 2.1 Format layer (the editor itself)
| Feature | Why it matters | ProfJohns today |
|---|---|---|
| Native rich-text with **tracked changes + comments** | Co-authors/advisors revise; the author must accept/reject, not paste blindly | TipTap editor exists; **no tracked-changes layer** |
| **Roundtrip DOCX** (Word ↔ editor, preserving citations + math) | Advisors live in Word; journals often require .docx | `docx` lib does one-way export; **no roundtrip** |
| LaTeX / Typst import + compile | STEM venues mandate LaTeX templates | Not present |
| Markdown as the storage format (plain text, git-friendly) | Lets AI see full context; versionable | TipTap JSON today |
| Live PDF preview alongside source | Authors proof as they write | Not present |

### 2.2 Citation & reference management
| Feature | Why it matters | ProfJohns today |
|---|---|---|
| In-editor **scholarly search** → insert citation | Stop switching to Google Scholar | Sources node finds; **not wired into the editor** as an insert |
| BibTeX / CSL export in **10,000+ styles** | Venue demands a specific style | Bibliography export exists; limited styles |
| **Existence-verification** of each reference vs OpenAlex/Crossref | Catches fabricated/hallucinated citations before submit | **Flagged as Phase 6 refinement — not built** |
| Reference metadata validation (authors, year, DOI) | Bad metadata = desk reject | Not present |
| Group/cluster references by theme | Literature-review scaffolding | Partial (Stack/Synthesize) |

### 2.3 AI assistance inside the editor
| Feature | Why it matters | ProfJohns today |
|---|---|---|
| **Context-aware** AI (reads the draft + connected sources) | Generic chat = irrelevant suggestions | Compose does this at section level |
| AI edits staged as **reviewable diffs** | Author stays "author of record" | Compose writes sections; **no inline diff/accept** |
| **Grounding meter** — refuse to fabricate when evidence is weak | Prevents hallucinated claims/citations | Audit tab flags supported/weak/unsupported — close |
| Section-specific writing (abstract, methods, rebuttal) | Each section has conventions | Partial |
| **LaTeX error auto-fix** | Compile errors block submission | N/A (no LaTeX) |
| Language polish tuned for academic prose | ESL authors; venue tone | Not present |

### 2.4 Collaboration & beyond-the-paper
| Feature | Why it matters | ProfJohns today |
|---|---|---|
| Real-time co-editing + offline-first | Multi-author papers | Local-first; no realtime |
| **Poster** generation from paper | Conferences | Not present |
| **Slide deck** from paper | Defense / talks | Not present |
| **Rebuttal / response-to-reviewers** drafting | Post-review revision | Not present |

---

## 3. The journal-submission layer (the real gap)

### 3.1 What submission portals actually require
From [ScholarOne](https://www.silverchair.com/products/scholarone-manuscripts/)
and [Editorial Manager](https://service.elsevier.com/app/answers/detail/a_id/28461/supporthub/publishing/)
(9,000+ journals, 3M+ manuscripts/year):

1. **Article-type-driven multi-step form** — title, abstract, keywords, authors
   & institutions, reviewers suggested/opposed, funding, cover letter.
2. **File packaging** — main manuscript, figures as separate files, supplementary
   material, cover letter, CRediT contributor roles, conflict-of-interest.
3. **Identity standards** — ORCID, RINGGOLD institution IDs, Open Funder Registry.
4. **Integrity checks** — iThenticate similarity, artwork quality check (AQC),
   reference validation vs PubMed/Crossref, checkCIF (crystallography).
5. **CRediT taxonomy** — 14 contributor roles per author.
6. **Metadata in JATS** for downstream production.

### 3.2 How "submit" works today (three tiers)
| Tier | Mechanism | Example |
|---|---|---|
| **Publisher API** — one-click from editor | Overleaf ↔ Aries EM Ingest Service; "Submit to Journal" button | [Overleaf docs](https://docs.overleaf.com/templates/submiting-to-publishers) |
| **Browser automation** — autofill the portal | [PaperPush](https://github.com/pachterlab/paperpush) (2026, Playwright + AI autofill) | 17+ venues (Nature, Cell, Science, PLOS, arXiv, bioRxiv) |
| **Manual** — download, reupload, retype metadata | The default for most researchers | — |

**PaperPush is the key reference architecture** for a product without per-publisher API deals: `subfile` (template) → `autofill` (LLM fills metadata from manuscript) → `validate` → `login` → `submit` (fills form, user reviews, user clicks final submit).

### 3.3 Submission-readiness checks (the "pre-flight")
The competitive set has converged on a pre-submission gate. From
[Paperpal](https://paperpal.com/) (1M+ papers checked, 1,500+ journals) and
[DocuGuru](https://docuguru.ai/):

- Plagiarism / similarity (iThenticate-equivalent)
- **AI-generated-text detection** (increasingly required by venue policy)
- Reference error checking (metadata + existence)
- Journal-specific formatting compliance (word count, figure limits, section order)
- Grammar/tone for academic prose
- **30+ pre-submission checks** per journal (Paperpal's selling point)

### 3.4 The hallucinated-citation crisis (the strongest differentiator)
This is the single most important finding for ProfJohns' positioning:

- **~1 in 4 NeurIPS 2025 papers** and **~1 in 3 USENIX Security 2025 papers**
  contain at least one likely hallucinated reference. ([Phantom References, Russinovich et al.](https://arxiv.org/html/2607.00738))
- **Peer review does not catch them** — zero correlation between reviewer rating
  and citation integrity.
- **ICLR 2026 and ICML 2026 now list hallucinated references as grounds for desk
  rejection.**
- LLM-as-judge alone has recall as low as **16–17%**; retrieval-augmented
  verification (CiteGuard, CiteCheck) reaches ~88% macro-F1 and costs **~$0.04
  per paper**. ([CiteGuard](https://aclanthology.org/2026.acl-long.282.pdf), [CiteCheck](https://arxiv.org/html/2605.27700))

**ProfJohns already has the right architecture for this**: Compose's
"traceability by construction" means a citation must trace to a board source —
a fabricated citation "is never laundered." The missing piece is
**existence-verification** (does that source actually exist in OpenAlex/Crossref?)
— already on the Phase 6 refinement list.

---

## 4. Competitive map (where ProfJohns would sit)

| Capability | Overleaf | Paperpal | ScriptOra | DocuGuru | Bibby | PaperPush | **ProfJohns** |
|---|---|---|---|---|---|---|---|
| Canvas-based thinking | — | — | — | — | — | — | **yes (unique)** |
| Trained-on-you writing voice | — | — | — | — | — | — | **yes (unique)** |
| Background search agents | — | — | — | — | — | — | **yes (unique)** |
| Semantic + figure reverse search | — | — | — | — | — | — | **yes (own-corpus)** |
| Traceable citations (no laundering) | — | — | partial | — | partial | — | **yes (unique)** |
| Existence-verified references | — | yes | — | — | — | validate step | **planned** |
| Submission-readiness checks | — | yes (strong) | — | yes | — | — | **planned** |
| Venue template library | 1,000+ | — | multiple | 18,000+ | multiple | — | **planned** |
| One-click reformat between venues | — | — | — | yes | yes | — | **planned** |
| Direct submission (API) | yes (Aries) | — | — | — | — | automation | **planned** |
| Rebuttal drafting | — | — | yes | — | — | — | **planned** |
| Poster/slides from paper | — | — | yes | yes | — | — | **planned** |
| Tracked changes / Word roundtrip | mature | — | — | — | — | — | **planned** |

**Positioning:** ProfJohns' moat is the **canvas + personal agents + provenance**.
The submission layer is table-stakes the competitors already have — we must
close it, but we win on *trust* (traceability + existence verification), not on
having the largest template library.

---

## 5. Feature requirements for ProfJohns' submission layer

Derived from the above, prioritized by (value × fit with existing architecture)
÷ effort. These become candidate epics for the plan.

### Tier 0 — Trust (differentiator, mostly already designed)
- **E0.1 Existence-verification** — every citation mark resolved against
  OpenAlex/Crossref; status badge (verified / metadata-mismatch / not-found).
  Reuses Sources provider routes. (VISION Phase 6 refinement.)
- **E0.2 Citation-faithfulness audit** — retrieval-grounded check that each
  [n] supports the claim it's attached to (CiteCheck-style). Extends the Audit tab.
- **E0.3 No-fabrication guard in Compose** — when a source is weak/missing, emit
  a visible "unsupported" marker instead of inventing a reference. Already partly
  true; make it a hard gate.

### Tier 1 — Submission-readiness (pre-flight)
- **E1.1 Submission checklist engine** — per-venue rules (word count, abstract
  length, figure count/format, section order, reference style, CRediT, funding).
  Data model: `VenueSpec` keyed by journal id.
- **E1.2 Manuscript metadata model** — title, abstract, keywords, authors +
  ORCID + institution (RINGGOLD/ROR) + CRediT roles, funding (Open Funder
  Registry), conflicts, cover letter. One structured object, reused by export + submit.
- **E1.3 DOCX roundtrip** — two-way Word ↔ editor preserving citation marks and
  tracked changes (Manuscript-Markdown approach: Markdown as interchange,
  CriticMarkup for changes, BibTeX/CSL for citations).
- **E1.4 Cover-letter + rebuttal writer** — agent-driven, grounded in the paper.

### Tier 2 — Venue formatting
- **E2.1 Venue template registry** — start with the ~20 highest-traffic venues
  for the target audience (medical/CS), not 18,000. IEEE, Nature, Elsevier, ACM,
  Springer, JAMA, Lancet, NEJM, Cell. Format = DOCX or LaTeX per venue.
- **E2.2 One-click retarget** — re-render the same manuscript against a
  different `VenueSpec` (DocuGuru/Bibby's headline feature).

### Tier 3 — Submit
- **E3.1 Submission file packaging** — main + figures + supplementary + cover
  letter + metadata, named per venue rules. Zip + per-file.
- **E3.2 Browser-automation submission** — PaperPush-pattern: Playwright-driven
  autofill of the portal form from the metadata model; user reviews and clicks
  final submit. Start with arXiv/bioRxiv (preprints, lower risk) + 2–3 journals.
- **E3.3 (later) Publisher API integration** — Aries EM Ingest for one-click,
  where a deal is feasible.

### Tier 4 — Beyond the paper
- **E4.1 Poster + slide generation** from the manuscript.
- **E4.2 Rebuttal Studio** — reviewer comments → tracked responses with
  manuscript grounding (ScriptOra pattern).

---

## 6. What we deliberately defer
- A 10,000-style or 18,000-template library — YAGNI; start with the venues the
  target audience actually uses.
- Real-time multi-user co-editing — large infra cost; tracked-changes roundtrip
  covers the advisor-collaboration case first.
- Native LaTeX compile in-app — partner/defer until a venue mandates it; DOCX
  covers the medical audience first.
- Per-publisher API deals — browser automation reaches 80% of venues without BD.

---

## 7. Key sources
- [Papers.ai (Overleaf)](https://papers.ai/) — unified workspace, DOCX + LaTeX
- [ScriptOra](https://scriptora.ai/) — AI-native LaTeX, grounding meter, Rebuttal/Poster Studio
- [Bibby AI paper](https://arxiv.org/abs/2607.05435) — editor-native agents, compile-verified edits
- [Manuscript Markdown](https://github.com/jbearak/manuscript-markdown) — DOCX↔Markdown roundtrip with citations
- [Paperpal](https://paperpal.com/) — submission-readiness checks, 30+ pre-flight
- [DocuGuru](https://docuguru.ai/) — 18,000 templates, one-click retarget, peer-review sim
- [ScholarOne](https://www.silverchair.com/products/scholarone-manuscripts/) — submission-portal requirements
- [Editorial Manager](https://service.elsevier.com/app/answers/detail/a_id/28461/supporthub/publishing/) — reference checking, CRediT, ORCID
- [PaperPush](https://github.com/pachterlab/paperpush) — browser-automation submission reference architecture
- [Phantom References](https://arxiv.org/html/2607.00738) — hallucinated-citation crisis
- [CiteGuard](https://aclanthology.org/2026.acl-long.282.pdf) — retrieval-augmented citation verification
- [CiteCheck](https://arxiv.org/html/2605.27700) — grounded detection, 88.7% macro-F1
- [Overleaf publisher submission](https://docs.overleaf.com/templates/submiting-to-publishers) — API-tier integration