/**
 * Draft Pipeline — client-side orchestration for generating a full research
 * draft from a topic. Each step is a separate API call, keeping within
 * serverless timeouts.
 *
 * Inspired by OpenDraft's 19-agent pipeline, adapted for ProfJohns' existing
 * AI modes and client-side architecture.
 *
 * Pipeline phases:
 *   1. Search — gather sources from all providers
 *   2. Outline — generate section structure
 *   3. Draft — write each section with citations
 *   4. Verify — verify citations against CrossRef/OpenAlex
 *   5. Polish — (optional) revise for flow and coherence
 */

import type { PaperSource } from "./mock";
import type { SourceProvider } from "./sources-client";
import { searchProvider, PROVIDER_ORDER } from "./sources-client";
import { proposeOutline, writeSection, auditDraft, type AuditFinding } from "./ai-client";

export type PipelinePhase = "search" | "outline" | "draft" | "verify" | "polish" | "done" | "error";

export interface PipelineState {
  phase: PipelinePhase;
  currentSection: number;
  totalSections: number;
  sectionTitle: string | null;
  sourcesFound: number;
  errors: string[];
  auditFindings: AuditFinding[] | null;
}

export interface PipelineCallbacks {
  onStateChange: (state: PipelineState) => void;
  onSources: (sources: PaperSource[]) => void;
  onOutline: (sections: string[]) => void;
  onSectionDrafted: (index: number, title: string, prose: string) => void;
  onAudit: (findings: AuditFinding[]) => void;
}

export interface PipelineOptions {
  topic: string;
  paperType: "research_paper" | "literature_review" | "thesis" | "report";
  language?: string;
  providers?: SourceProvider[];
  style?: string;
  persona?: string;
  maxSources?: number;
}

/**
 * Runs the full draft pipeline. Each phase is a sequence of API calls.
 * The caller provides callbacks for each output; the pipeline manages
 * state transitions and error recovery.
 */
export async function runDraftPipeline(
  options: PipelineOptions,
  callbacks: PipelineCallbacks,
): Promise<void> {
  const { topic, providers = PROVIDER_ORDER, style, persona, maxSources = 30 } = options;
  const errors: string[] = [];

  // ---- Phase 1: Search ----
  callbacks.onStateChange({
    phase: "search",
    currentSection: 0,
    totalSections: 0,
    sectionTitle: null,
    sourcesFound: 0,
    errors,
    auditFindings: null,
  });

  const allSources: PaperSource[] = [];
  const seen = new Set<string>();

  for (const provider of providers) {
    try {
      const results = await searchProvider(provider, topic);
      for (const s of results) {
        if (!seen.has(s.id) && !seen.has(s.title.toLowerCase())) {
          seen.add(s.id);
          seen.add(s.title.toLowerCase());
          allSources.push(s);
        }
        if (allSources.length >= maxSources) break;
      }
      if (allSources.length >= maxSources) break;
    } catch (err) {
      errors.push(`Search (${provider}): ${err instanceof Error ? err.message : "failed"}`);
    }
  }

  if (allSources.length === 0) {
    errors.push("No sources found. Try a different topic or broader search terms.");
    callbacks.onStateChange({
      phase: "error",
      currentSection: 0,
      totalSections: 0,
      sectionTitle: null,
      sourcesFound: 0,
      errors,
      auditFindings: null,
    });
    return;
  }

  callbacks.onSources(allSources);
  callbacks.onStateChange({
    phase: "search",
    currentSection: 0,
    totalSections: 0,
    sectionTitle: null,
    sourcesFound: allSources.length,
    errors,
    auditFindings: null,
  });

  // ---- Phase 2: Outline ----
  callbacks.onStateChange({
    phase: "outline",
    currentSection: 0,
    totalSections: 0,
    sectionTitle: null,
    sourcesFound: allSources.length,
    errors,
    auditFindings: null,
  });

  let sections: string[];
  try {
    sections = await proposeOutline(allSources, undefined, persona);
  } catch (err) {
    errors.push(`Outline: ${err instanceof Error ? err.message : "failed"}`);
    callbacks.onStateChange({
      phase: "error",
      currentSection: 0,
      totalSections: 0,
      sectionTitle: null,
      sourcesFound: allSources.length,
      errors,
      auditFindings: null,
    });
    return;
  }

  if (sections.length === 0) {
    errors.push("Outline generation returned no sections.");
    callbacks.onStateChange({
      phase: "error",
      currentSection: 0,
      totalSections: 0,
      sectionTitle: null,
      sourcesFound: allSources.length,
      errors,
      auditFindings: null,
    });
    return;
  }

  callbacks.onOutline(sections);

  // ---- Phase 3: Draft each section ----
  for (let i = 0; i < sections.length; i++) {
    const sectionTitle = sections[i];
    callbacks.onStateChange({
      phase: "draft",
      currentSection: i + 1,
      totalSections: sections.length,
      sectionTitle,
      sourcesFound: allSources.length,
      errors,
      auditFindings: null,
    });

    try {
      const prose = await writeSection({
        sectionTitle,
        outline: sections,
        sources: allSources,
        style,
        persona,
      });
      callbacks.onSectionDrafted(i, sectionTitle, prose);
    } catch (err) {
      const msg = `Section "${sectionTitle}": ${err instanceof Error ? err.message : "failed"}`;
      errors.push(msg);
      callbacks.onSectionDrafted(i, sectionTitle, "");
    }
  }

  // ---- Phase 4: Verify (audit) ----
  callbacks.onStateChange({
    phase: "verify",
    currentSection: sections.length,
    totalSections: sections.length,
    sectionTitle: null,
    sourcesFound: allSources.length,
    errors,
    auditFindings: null,
  });

  // Note: the actual draft text will be assembled by the caller from onSectionDrafted callbacks.
  // The audit runs on the full draft. We pass a placeholder — the caller should
  // run the audit separately if they want citation verification.

  // ---- Phase 5: Done ----
  callbacks.onStateChange({
    phase: "done",
    currentSection: sections.length,
    totalSections: sections.length,
    sectionTitle: null,
    sourcesFound: allSources.length,
    errors,
    auditFindings: null,
  });
}

/**
 * Runs the audit (citation verification) phase on a completed draft.
 * Called separately after the pipeline completes, since it needs the
 * full draft text.
 */
export async function runAuditPhase(
  draftText: string,
  sources: PaperSource[],
  callbacks: Pick<PipelineCallbacks, "onStateChange" | "onAudit">,
  errors: string[] = [],
): Promise<void> {
  callbacks.onStateChange({
    phase: "verify",
    currentSection: 0,
    totalSections: 0,
    sectionTitle: null,
    sourcesFound: sources.length,
    errors,
    auditFindings: null,
  });

  try {
    const findings = await auditDraft(draftText, sources);
    callbacks.onAudit(findings);
    callbacks.onStateChange({
      phase: "done",
      currentSection: 0,
      totalSections: 0,
      sectionTitle: null,
      sourcesFound: sources.length,
      errors,
      auditFindings: findings,
    });
  } catch (err) {
    errors.push(`Audit: ${err instanceof Error ? err.message : "failed"}`);
    callbacks.onStateChange({
      phase: "error",
      currentSection: 0,
      totalSections: 0,
      sectionTitle: null,
      sourcesFound: sources.length,
      errors,
      auditFindings: null,
    });
  }
}
