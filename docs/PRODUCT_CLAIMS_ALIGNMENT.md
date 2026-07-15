# Product Claims Alignment (FEATURE-001 through 006)

This document tracks each marketing claim and its alignment with the
shipped implementation. Each claim is either implemented, revised, or
marked for future work.

## FEATURE-001: Citation standards

**Current claim:** "Standards-compliant citations (APA, IEEE, Nature, MLA)"

**Shipped behavior:** Basic citation formatting presets (display-string
generation from author/year/title fields).

**Action:** Revise claim to:
> Basic citation formatting presets. Full CSL (Citation Style Language)
> compliance with APA, IEEE, Nature, and MLA is planned for a future release.

**To claim standards compliance in the future:**
- Use structured author data (not display strings)
- Preserve DOI, issue, volume, pages, publisher, access date
- Implement a CSL processor (e.g., citeproc-js)
- Add official CSL styles for APA, IEEE, Nature, and MLA
- Test journal articles, books, websites, preprints, missing metadata
- Preserve citations in DOCX, Markdown, and LaTeX exports

## FEATURE-002: Citation verification

**Current claim:** "Citations are verified"

**Shipped behavior:** AI-based citation auditing (draft vs. sources),
which is approximate, not a formal verification.

**Action:** Revise claim to:
> AI-assisted citation auditing compares your draft against connected
> sources. This is not a formal verification — always confirm citations
> against the original literature.

**To claim formal verification in the future:**
- Resolve DOI/arXiv/OpenAlex/Semantic Scholar identifiers
- Store immutable source provenance
- Audit against full text or page-level passages (not only abstracts)
- Attach evidence spans and page numbers to verdicts
- Separate: source exists, metadata matches, source supports claim,
  citation format is valid
- Display uncertainty (not a binary verified label)

## FEATURE-003: Always-on background agent

**Current claim:** "Always-on background agent"

**Shipped behavior:** Scheduled source discovery (daily cron sweep that
finds new papers for saved search topics).

**Action:** Revise claim to:
> Scheduled source watch — the agent checks for new papers on a daily
> schedule. Full always-on background research (with reading, extraction,
  gap analysis, and draft generation) is planned for a future release.

**To deliver the advertised feature:**
- Durable job queue (not Vercel Cron)
- Per-user concurrency and cost limits
- Full-text acquisition (not just metadata)
- Reading/extraction pipeline
- Source scoring, gap analysis, draft generation
- Per-project memory
- Progress and cancellation
- Notifications, retry, dead-letter handling
- Provenance for every generated statement

## FEATURE-004: Writing DNA

**Current claim:** "Writing DNA — learns your voice"

**Shipped behavior:** AI-derived style profile from writing samples.

**Action:** Revise claim to:
> Writing DNA — an AI-derived style profile from your writing samples.
> Your sample is sent to the AI provider (OpenRouter) for analysis and
> is stored encrypted. You can delete it at any time.

**Privacy requirements (implemented before broader release):**
- Explicit consent before uploading writing samples
- Explain which provider receives the sample
- Permit local deletion and cloud deletion
- Avoid storing verbatim excerpts in a general profile
- Encrypt sensitive corpus storage
- Regression tests showing the profile is applied only to the correct
  user/project

## FEATURE-005: Data visualization

**Current claim:** "Visualize papers by year, method, or venue"

**Shipped behavior:** Year-based visualization (existing).

**Action:** Revise claim to:
> Visualize papers by publication year. Grouping by method or venue
> is planned for a future release.

**OR implement:**
- Year chart (exists)
- Venue grouping chart
- Method taxonomy/extraction
- Accessible data table alternative
- Empty and insufficient-data states
- Exportable image/data
- Chart keyboard and screen-reader support

## FEATURE-006: Platform claim

**Current claim:** "macOS and Windows" (implies native apps)

**Shipped behavior:** Web application (works in browsers on macOS,
Windows, and other platforms).

**Action:** Revise claim to:
> Web — usable on macOS, Windows, and Linux browsers.

**To claim native macOS and Windows in the future:**
- Electron or Tauri packaging
- Signed installers (Apple Developer ID, Windows Authenticode)
- Auto-updates
- OS-specific filesystem permissions
- Offline storage
- Crash reporting
- Release channels (stable, beta)
