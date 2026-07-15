"use client";

import * as React from "react";
import {
  Sparkle as Sparkles,
  Quotes as Quote,
  Plus,
  Highlighter,
  CircleNotch as Loader2,
  WarningCircle as AlertCircle,
  Link as Link2,
  TreeStructure as ListTree,
  X,
  DotsSixVertical as GripVertical,
  MagicWand as Wand2,
  PencilSimpleLine as PenLine,
  ArrowsOutSimple as Maximize2,
  Minus,
  ShieldCheck,
  CheckCircle,
  XCircle,
  type Icon,
} from "@phosphor-icons/react";
import { SurfaceShell } from "./surface-shell";
import { WritingDocument } from "./writing-document";
import { ExportMenu } from "./export-menu";
import { StyleSelector, ReferencesPanel } from "./references-panel";
import { getModel } from "@/lib/models";
import { useCanvasStore } from "@/store/canvas-store";
import { useNodeInputSources } from "@/store/use-sources";
import {
  writeFromSources,
  editText,
  auditDraft,
  suggestTitles,
  proposeOutline,
  writeSection,
  type AuditFinding,
} from "@/lib/ai-client";
import { sectionToContent } from "@/lib/compose";
import type { Synthesis } from "@/lib/ai-client";
import { formatInText, DEFAULT_STYLE } from "@/lib/citation";
import { getDocEditor } from "@/components/editor/doc-editor";
import { LilyVoice } from "./lily-voice";
import { AgentPicker, useNodeAgent } from "@/components/canvas/agent-picker";
import { agentSystemPrompt } from "@/lib/agents";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  extractText,
  extractCitedPaperIds,
  paragraphsToContent,
} from "@/lib/document";

export function WritingSurface({
  nodeId,
  direction,
  modelId,
  onClose,
}: {
  nodeId: string;
  direction: string;
  modelId: string;
  onClose: () => void;
}) {
  const model = getModel(modelId);
  const spendCredits = useCanvasStore((s) => s.spendCredits);
  const setDocContent = useCanvasStore((s) => s.setDocContent);
  const doc = useCanvasStore((s) => s.docs[nodeId]);
  const setDocOutline = useCanvasStore((s) => s.setDocOutline);
  const updateDocTitle = useCanvasStore((s) => s.updateDocTitle);
  const sources = useNodeInputSources(nodeId);
  const styleProfile = useWorkspaceStore((s) => s.styleProfile);
  const [useVoice, setUseVoice] = React.useState(true);

  // The writer runs from the Stylist agent (overridable) — its persona shapes
  // drafting, layered under Lily's voice profile.
  const writerAgent = useNodeAgent(nodeId, "stylist");

  const [instruction, setInstruction] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [busyLabel, setBusyLabel] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<"ai" | "compose" | "sources" | "outline" | "audit">("ai");

  const outline = doc?.outline ?? [];
  const draftText = React.useMemo(() => extractText(doc?.content), [doc?.content]);

  async function runWrite(preset?: string) {
    const instr = (preset ?? instruction).trim();
    if (!instr || busy) return;
    if (sources.length === 0) {
      setError("Connect a source node to write from.");
      return;
    }
    setBusy(true);
    setBusyLabel("Writing…");
    setError(null);
    try {
      const answer = await writeFromSources(
        instr,
        sources,
        draftText,
        useVoice && styleProfile ? styleProfile : undefined,
        writerAgent ? agentSystemPrompt(writerAgent) : undefined,
      );
      const nodes = paragraphsToContent(answer);
      const editor = getDocEditor(nodeId);
      // Append the generated prose to the end of the draft (undoable in-editor).
      if (editor) editor.chain().focus("end").insertContent(nodes).run();
      else setDocContent(nodeId, { type: "doc", content: nodes });
      spendCredits(model.creditsPerRun);
      if (!preset) setInstruction("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "The assistant failed.");
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  }

  /** Apply an editing action to the existing draft text. */
  async function applyEdit(instr: string, label: string) {
    if (!draftText.trim() || busy) return;
    setBusy(true);
    setBusyLabel(label);
    setError(null);
    try {
      const answer = await editText(draftText, instr);
      const content = { type: "doc", content: paragraphsToContent(answer) };
      const editor = getDocEditor(nodeId);
      if (editor) editor.commands.setContent(content);
      else setDocContent(nodeId, content);
      spendCredits(model.creditsPerRun);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Edit failed.");
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  }

  return (
    <SurfaceShell
      kind="writing"
      direction={direction}
      onClose={onClose}
      toolbar={
        <div className="flex items-center gap-1.5">
          <StyleSelector nodeId={nodeId} />
          <ExportMenu nodeId={nodeId} doc={doc} />
        </div>
      }
    >
      <div className="flex h-full">
        {/* The document is the hero — it owns the main area at every width. */}
        <div className="min-w-0 flex-1 overflow-y-auto bg-grey-50 px-6 py-8 lg:px-10">
          <WritingDocument nodeId={nodeId} direction={direction} />
          <ReferencesPanel nodeId={nodeId} />
        </div>

        {/* One tabbed assistant — AI writer, the sources you can cite, outline. */}
        <aside className="flex w-[340px] shrink-0 flex-col border-l border-grey-200 bg-paper">
          <div className="flex items-center gap-1 border-b border-grey-100 p-1.5">
            <TabButton
              active={tab === "ai"}
              onClick={() => setTab("ai")}
              icon={Sparkles}
              label="Write"
            />
            <TabButton
              active={tab === "compose"}
              onClick={() => setTab("compose")}
              icon={Wand2}
              label="Compose"
            />
            <TabButton
              active={tab === "sources"}
              onClick={() => setTab("sources")}
              icon={Quote}
              label="Sources"
              count={sources.length || undefined}
            />
            <TabButton
              active={tab === "outline"}
              onClick={() => setTab("outline")}
              icon={ListTree}
              label="Outline"
              count={outline.length || undefined}
            />
            <TabButton
              active={tab === "audit"}
              onClick={() => setTab("audit")}
              icon={ShieldCheck}
              label="Audit"
            />
          </div>

          {tab === "ai" && (
            <AiPanel
              nodeId={nodeId}
              model={model}
              sources={sources}
              draftText={draftText}
              onPickTitle={(t) => updateDocTitle(nodeId, t)}
              draftEmpty={!draftText.trim()}
              busy={busy}
              busyLabel={busyLabel}
              error={error}
              instruction={instruction}
              onInstruction={setInstruction}
              onRunWrite={runWrite}
              onApplyEdit={applyEdit}
              useVoice={useVoice}
              onToggleVoice={setUseVoice}
            />
          )}
          {tab === "compose" && (
            <ComposePanel
              nodeId={nodeId}
              sources={sources}
              creditsPerRun={model.creditsPerRun}
              onSpend={spendCredits}
              persona={writerAgent ? agentSystemPrompt(writerAgent) : undefined}
              voice={useVoice && styleProfile ? styleProfile : undefined}
            />
          )}
          {tab === "sources" && <SourcesPanel nodeId={nodeId} />}
          {tab === "outline" && (
            <OutlinePanel
              outline={outline}
              onChange={(o) => setDocOutline(nodeId, o)}
            />
          )}
          {tab === "audit" && (
            <AuditPanel
              nodeId={nodeId}
              draftText={draftText}
              sources={sources}
              creditsPerRun={model.creditsPerRun}
              onSpend={spendCredits}
            />
          )}
        </aside>
      </div>
    </SurfaceShell>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: Icon;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[11.5px] font-medium transition-colors ${active ? "bg-ink text-paper" : "text-grey-600 hover:bg-grey-100"}`}
    >
      <Icon className="size-3.5 shrink-0" />
      {label}
      {count != null && (
        <span
          className={`tabular-nums ${active ? "text-grey-300" : "text-grey-400"}`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function SourcesPanel({ nodeId }: { nodeId: string }) {
  const papers = useNodeInputSources(nodeId);
  const highlightMap = useCanvasStore((s) => s.highlights);

  function citationIndex(paper: (typeof papers)[number]) {
    const doc = useCanvasStore.getState().docs[nodeId];
    const style = doc?.style ?? DEFAULT_STYLE;
    const existing = extractCitedPaperIds(doc?.content);
    const index = existing.includes(paper.id)
      ? existing.indexOf(paper.id) + 1
      : existing.length + 1;
    return { style, index };
  }

  // Cite = insert the in-text citation marker at the cursor, carrying the
  // paperId on a citation mark. The references panel derives the cited set
  // from these marks — single source of truth.
  function cite(paper: (typeof papers)[number]) {
    const editor = getDocEditor(nodeId);
    if (!editor) return;
    const { style, index } = citationIndex(paper);
    editor
      .chain()
      .focus()
      .insertContent([
        { type: "text", text: " " },
        {
          type: "text",
          text: formatInText(paper, style, index),
          marks: [{ type: "citation", attrs: { paperId: paper.id } }],
        },
      ])
      .run();
  }

  function insertQuote(paper: (typeof papers)[number], text: string) {
    const editor = getDocEditor(nodeId);
    if (!editor) return;
    const { style, index } = citationIndex(paper);
    editor
      .chain()
      .focus("end")
      .insertContent([
        {
          type: "paragraph",
          content: [
            { type: "text", text: `“${text}” ` },
            {
              type: "text",
              text: formatInText(paper, style, index),
              marks: [{ type: "citation", attrs: { paperId: paper.id } }],
            },
          ],
        },
      ])
      .run();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="border-b border-grey-100 px-3 py-2.5 text-[11px] leading-snug text-grey-400">
        Cite any connected source into your draft, or drop in a highlight you
        saved while reading.
      </p>
      <div className="flex-1 overflow-y-auto p-3">
        {papers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-grey-200 px-3 py-6 text-center text-[11px] leading-snug text-grey-400">
            No sources connected. Wire a Sources, Paper, or Library node into
            this draft on the canvas, then cite from it here.
          </p>
        ) : (
          <ul className="space-y-2">
            {papers.map((paper, i) => {
              const paperHighlights = highlightMap[paper.id] ?? [];
              return (
                <li
                  key={paper.id}
                  className="group rounded-md border border-grey-200 p-3 transition-colors hover:border-grey-400"
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-sm bg-grey-100 text-[10px] font-medium text-grey-700">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-xs font-medium text-ink">
                        {paper.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-grey-400">
                        {paper.authors} · {paper.year}
                      </p>
                    </div>
                  </div>

                  {paperHighlights.length > 0 && (
                    <ul className="mt-2 space-y-1 border-l-2 border-grey-200 pl-2">
                      {paperHighlights.map((h) => (
                        <li key={h.id}>
                          <button
                            onClick={() => insertQuote(paper, h.text)}
                            title="Insert quote into draft"
                            className="group/hl flex w-full items-start gap-1.5 text-left"
                          >
                            <Highlighter className="mt-0.5 size-3 shrink-0 text-grey-400 group-hover/hl:text-ink" />
                            <span className="line-clamp-2 text-[11px] leading-snug text-grey-600 group-hover/hl:text-ink">
                              {h.text}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <button
                    onClick={() => cite(paper)}
                    className="mt-2 flex w-full items-center justify-center gap-1 rounded-md bg-grey-100 py-1.5 text-[11px] font-medium text-grey-700 transition-colors hover:bg-grey-200 hover:text-ink"
                  >
                    <Plus className="size-3" />
                    Cite in draft
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

const WRITE_PRESETS = [
  "Draft the next section from these sources",
  "Synthesize key themes across all sources",
  "Write a critical analysis with counter-arguments",
];

const EDIT_PRESETS = [
  { label: "Fix grammar & clarity", instruction: "Fix grammar, spelling, and clarity. Improve sentence structure and word choice.", icon: Wand2 },
  { label: "Make more formal", instruction: "Rewrite in a formal academic tone. Use precise vocabulary, avoid contractions, strengthen assertions.", icon: PenLine },
  { label: "Make more accessible", instruction: "Simplify for a broader audience. Use shorter sentences, plain language, and concrete examples.", icon: Minus },
  { label: "Tighten prose", instruction: "Cut filler words, redundancy, and passive constructions. Make every sentence earn its place.", icon: Minus },
  { label: "Expand section", instruction: "Expand each point with more detail, nuance, and evidence. Add depth without padding.", icon: Maximize2 },
  { label: "Improve flow", instruction: "Improve paragraph transitions, argument structure, and logical flow. Connect ideas smoothly.", icon: Wand2 },
];

const PRESETS = [
  "Draft the next section from these sources",
  "Synthesize the key themes across the sources",
  "Add counter-arguments with citations",
  "Tighten and clarify the current draft",
];

/**
 * Compose — canvas → paper (VISION Phase 6). Proposes a section outline from
 * the board's sources + synthesis claims, then drafts section-by-section from
 * the sources YOU select; every [n] the writer cites becomes a real citation
 * mark, so each sentence stays traceable to a node on the board.
 */
function ComposePanel({
  nodeId,
  sources,
  creditsPerRun,
  onSpend,
  persona,
  voice,
}: {
  nodeId: string;
  sources: ReturnType<typeof useNodeInputSources>;
  creditsPerRun: number;
  onSpend: (amount: number) => void;
  persona?: string;
  voice?: string;
}) {
  const doc = useCanvasStore((s) => s.docs[nodeId]);
  const setDocOutline = useCanvasStore((s) => s.setDocOutline);
  const setDocContent = useCanvasStore((s) => s.setDocContent);
  const outline = React.useMemo(() => doc?.outline ?? [], [doc?.outline]);

  // Synthesis claims from processor nodes wired directly into this draft.
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const claimsText = React.useMemo(() => {
    const incomerIds = edges.filter((e) => e.target === nodeId).map((e) => e.source);
    const claims = nodes
      .filter((n) => incomerIds.includes(n.id) && n.data.kind === "processor")
      .flatMap((n) => (n.data.synthesis as Synthesis | undefined)?.claims ?? []);
    if (claims.length === 0) return undefined;
    return claims.map((c) => `- ${c.claim}`).join("\n").slice(0, 4000);
  }, [nodes, edges, nodeId]);

  const [busy, setBusy] = React.useState<string | null>(null); // "outline" | section title
  const [error, setError] = React.useState<string | null>(null);
  // Per-section deselected paper ids (default = every source selected).
  const [deselected, setDeselected] = React.useState<Record<number, string[]>>({});

  async function runOutline() {
    if (busy || sources.length === 0) return;
    setBusy("outline");
    setError(null);
    try {
      const titles = await proposeOutline(sources, claimsText, persona);
      if (titles.length > 0) setDocOutline(nodeId, titles);
      else setError("Couldn't derive an outline — add or connect more sources.");
      onSpend(creditsPerRun);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Outline failed.");
    } finally {
      setBusy(null);
    }
  }

  function sectionPapers(i: number) {
    const off = new Set(deselected[i] ?? []);
    return sources.filter((p) => !off.has(p.id));
  }

  function togglePaper(i: number, id: string) {
    setDeselected((d) => {
      const cur = new Set(d[i] ?? []);
      if (cur.has(id)) cur.delete(id);
      else cur.add(id);
      return { ...d, [i]: [...cur] };
    });
  }

  async function draftSection(i: number) {
    const title = outline[i];
    const papers = sectionPapers(i);
    if (!title || busy || papers.length === 0) return;
    setBusy(title);
    setError(null);
    try {
      const prose = await writeSection({
        sectionTitle: title,
        outline,
        sources: papers,
        claimsText,
        style: voice,
        persona,
      });
      const state = useCanvasStore.getState();
      const current = state.docs[nodeId]?.content;
      const cited = extractCitedPaperIds(current);
      const style = state.docs[nodeId]?.style ?? DEFAULT_STYLE;
      const content = sectionToContent(title, prose, papers, style, cited);
      const editor = getDocEditor(nodeId);
      if (editor) editor.chain().focus("end").insertContent(content).run();
      else
        setDocContent(nodeId, {
          type: "doc",
          content: [...(current?.content ?? []), ...content],
        });
      onSpend(creditsPerRun);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Section draft failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-3">
        <p className="flex items-start gap-1.5 px-1 text-[11px] leading-relaxed text-grey-500">
          <Wand2 className="mt-0.5 size-3.5 shrink-0 text-[var(--color-node-writing)]" />
          Build the paper from your board: outline from your sources
          {claimsText ? " and synthesis claims" : ""}, then draft each section
          from the sources you choose — every citation traces back.
        </p>

        <button
          onClick={runOutline}
          disabled={busy !== null || sources.length === 0}
          data-testid="compose-outline"
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-ink py-2 text-[12px] font-semibold text-paper transition-colors hover:bg-grey-800 disabled:opacity-40"
        >
          {busy === "outline" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Wand2 className="size-3.5" />
          )}
          {outline.length > 0 ? "Re-propose outline from board" : "Propose outline from board"}
        </button>
        {sources.length === 0 && (
          <p className="mt-1.5 px-1 text-[10.5px] text-grey-400">
            Connect a Sources node (or papers) to this draft first.
          </p>
        )}

        {error && (
          <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-2 text-[11px] text-red-600">
            <AlertCircle className="size-3.5 shrink-0" />
            {error}
          </p>
        )}

        {outline.length > 0 && (
          <ol className="mt-3 space-y-2">
            {outline.map((title, i) => {
              const papers = sectionPapers(i);
              return (
                <li key={`${i}-${title}`} className="rounded-lg border border-grey-200 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="grid size-5 shrink-0 place-items-center rounded bg-grey-100 text-[10px] font-semibold text-grey-600">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink">
                      {title}
                    </span>
                    <button
                      onClick={() => draftSection(i)}
                      disabled={busy !== null || papers.length === 0}
                      data-testid={`compose-draft-${i}`}
                      className="flex shrink-0 items-center gap-1 rounded-md border border-grey-200 px-2 py-1 text-[11px] font-medium text-grey-700 transition-colors hover:border-grey-400 hover:text-ink disabled:opacity-40"
                    >
                      {busy === title ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <PenLine className="size-3" />
                      )}
                      Draft
                    </button>
                  </div>
                  <details className="mt-1.5">
                    <summary className="cursor-pointer text-[10.5px] font-medium text-grey-400 hover:text-grey-600">
                      Sources for this section ({papers.length}/{sources.length})
                    </summary>
                    <ul className="mt-1 space-y-0.5">
                      {sources.map((p) => {
                        const on = !((deselected[i] ?? []).includes(p.id));
                        return (
                          <li key={p.id}>
                            <label className="flex cursor-pointer items-start gap-1.5 rounded px-1 py-0.5 text-[10.5px] leading-snug text-grey-600 hover:bg-grey-50">
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => togglePaper(i, p.id)}
                                className="mt-0.5 accent-[var(--color-ink)]"
                              />
                              <span className="min-w-0 flex-1 truncate">{p.title}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

/** AI title suggestions — proposes paper titles from the draft; click to apply. */
function TitleSuggestions({
  draftText,
  disabled,
  onPick,
}: {
  draftText: string;
  disabled: boolean;
  onPick: (title: string) => void;
}) {
  const [titles, setTitles] = React.useState<string[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function run() {
    if (busy || disabled) return;
    setBusy(true);
    setError(null);
    try {
      setTitles(await suggestTitles(draftText));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not suggest titles.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3 rounded-lg border border-grey-200 p-2.5">
      <button
        onClick={run}
        disabled={busy || disabled}
        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-grey-200 py-1.5 text-[11px] font-medium text-grey-700 transition-colors hover:border-grey-300 hover:bg-grey-50 disabled:opacity-40"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-node-writing" />}
        {busy ? "Thinking…" : titles ? "Suggest more titles" : "Suggest a title"}
      </button>
      {disabled && (
        <p className="mt-1.5 text-[10px] text-grey-400">Write a little first, then get title ideas.</p>
      )}
      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-[10.5px] text-red-600">
          <AlertCircle className="size-3 shrink-0" />
          {error}
        </p>
      )}
      {titles && titles.length > 0 && (
        <ul className="mt-2 space-y-1">
          {titles.map((t, i) => (
            <li key={i}>
              <button
                onClick={() => onPick(t)}
                className="w-full rounded-md px-2 py-1.5 text-left text-[11.5px] leading-snug text-grey-700 transition-colors hover:bg-grey-100 hover:text-ink"
                title="Use this title"
              >
                {t}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AiPanel({
  nodeId,
  model,
  sources,
  draftText,
  onPickTitle,
  draftEmpty,
  busy,
  busyLabel,
  error,
  instruction,
  onInstruction,
  onRunWrite,
  onApplyEdit,
  useVoice,
  onToggleVoice,
}: {
  nodeId: string;
  model: ReturnType<typeof getModel>;
  sources: ReturnType<typeof useNodeInputSources>;
  draftText: string;
  onPickTitle: (title: string) => void;
  draftEmpty: boolean;
  busy: boolean;
  busyLabel: string;
  error: string | null;
  instruction: string;
  onInstruction: (v: string) => void;
  onRunWrite: (preset?: string) => void;
  onApplyEdit: (instr: string, label: string) => void;
  useVoice: boolean;
  onToggleVoice: (v: boolean) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-3">
        {/* The writer agent (overridable) — its persona shapes drafting. */}
        <div className="mb-3">
          <AgentPicker nodeId={nodeId} archetype="stylist" />
        </div>

        <TitleSuggestions
          draftText={draftText}
          disabled={draftEmpty}
          onPick={onPickTitle}
        />

        {/* Lily — write in the author's learned voice. */}
        <LilyVoice useVoice={useVoice} onToggleVoice={onToggleVoice} />

        <p className="mt-3 flex items-center gap-1 px-1 text-[11px] text-grey-500">
          <Link2 className="size-3" />
          {sources.length} connected source{sources.length === 1 ? "" : "s"}
        </p>

        {/* Write presets */}
        <p className="px-1 pb-1.5 pt-3 text-[11px] uppercase tracking-wider text-grey-400">
          Draft from sources
        </p>
        <div className="flex flex-wrap gap-1.5">
          {WRITE_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => onRunWrite(p)}
              disabled={busy || sources.length === 0}
              className="rounded-full border border-grey-200 px-2.5 py-1 text-[11px] text-grey-700 transition-colors hover:border-grey-400 hover:bg-grey-50 disabled:opacity-40"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Edit presets — only when there's text to edit */}
        {!draftEmpty && (
          <>
            <p className="px-1 pb-1.5 pt-4 text-[11px] uppercase tracking-wider text-grey-400">
              Refine your draft
            </p>
            <div className="flex flex-wrap gap-1.5">
              {EDIT_PRESETS.map((e) => {
                const Icon = e.icon;
                return (
                  <button
                    key={e.label}
                    onClick={() => onApplyEdit(e.instruction, `Refining…`)}
                    disabled={busy}
                    className="flex items-center gap-1 rounded-full border border-grey-200 px-2.5 py-1 text-[11px] text-grey-700 transition-colors hover:border-grey-400 hover:bg-grey-50 disabled:opacity-40"
                  >
                    <Icon className="size-3" />
                    {e.label}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {busy && (
          <div className="mt-3 flex items-center gap-2 px-1 text-[12px] text-grey-500">
            <Loader2 className="size-3.5 animate-spin" />
            {busyLabel || "Working…"}
          </div>
        )}
        {error && (
          <p className="mt-3 flex items-start gap-1.5 rounded-md border border-grey-200 bg-grey-50 p-2.5 text-[11px] leading-snug text-grey-600">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            {error}
          </p>
        )}
      </div>

      <div className="border-t border-grey-100 p-3">
        <textarea
          value={instruction}
          onChange={(e) => onInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onRunWrite();
            }
          }}
          placeholder={sources.length === 0 ? "Connect sources first…" : "Tell the writer what to draft…"}
          rows={3}
          disabled={sources.length === 0}
          className="w-full resize-none rounded-md border border-grey-200 bg-grey-50 px-2.5 py-2 text-xs text-ink outline-none placeholder:text-grey-400 focus:border-grey-300 disabled:opacity-40"
        />
        <button
          onClick={() => onRunWrite()}
          disabled={busy || !instruction.trim() || sources.length === 0}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-ink py-2 text-xs font-medium text-paper transition-colors hover:bg-grey-800 disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Plus className="size-3.5" />
          )}
          Write into draft
        </button>
      </div>
    </div>
  );
}

function OutlinePanel({
  outline,
  onChange,
}: {
  outline: string[];
  onChange: (outline: string[]) => void;
}) {
  function addSection() {
    onChange([...outline, ""]);
  }

  function updateSection(index: number, value: string) {
    const next = [...outline];
    next[index] = value;
    // Remove empty items when editing
    onChange(next);
  }

  function removeSection(index: number) {
    onChange(outline.filter((_, i) => i !== index));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-3">
        <p className="mb-3 text-[11px] text-grey-400">
          Plan your document structure. Sections appear here only — they don't
          insert text into the draft.
        </p>
        {outline.length === 0 ? (
          <p className="text-[11px] text-grey-300">No sections yet.</p>
        ) : (
          <ul className="space-y-1">
            {outline.map((section, i) => (
              <li key={i} className="group flex items-center gap-1">
                <GripVertical className="size-3 shrink-0 text-grey-300" />
                <span className="grid size-5 shrink-0 place-items-center rounded-sm bg-grey-100 text-[10px] font-medium text-grey-700">
                  {i + 1}
                </span>
                <input
                  value={section}
                  onChange={(e) => updateSection(i, e.target.value)}
                  onBlur={() => {
                    // Remove truly empty sections on blur
                    if (!section.trim()) removeSection(i);
                  }}
                  placeholder={`Section ${i + 1}`}
                  className="min-w-0 flex-1 rounded border border-grey-100 bg-grey-50 px-1.5 py-0.5 text-[11px] text-grey-700 outline-none focus:border-grey-300"
                />
                <button
                  onClick={() => removeSection(i)}
                  className="grid size-5 shrink-0 place-items-center rounded text-grey-300 opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-grey-100 p-3">
        <button
          onClick={addSection}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-ink py-2 text-xs font-medium text-paper transition-colors hover:bg-grey-800"
        >
          <Plus className="size-3.5" />
          Add section
        </button>
      </div>
    </div>
  );
}

const STATUS_META: Record<
  AuditFinding["status"],
  { label: string; icon: Icon; cls: string }
> = {
  supported: { label: "Supported", icon: CheckCircle, cls: "text-emerald-600" },
  weak: { label: "Weak", icon: ShieldCheck, cls: "text-amber-600" },
  unsupported: { label: "Unsupported", icon: XCircle, cls: "text-red-600" },
};

/**
 * Johns — the citation auditor. Matches the draft's claims against the
 * connected sources and flags which are supported, weakly supported, or
 * unsupported, so every claim can be traced back to evidence.
 */
function AuditPanel({
  nodeId,
  draftText,
  sources,
  creditsPerRun,
  onSpend,
}: {
  nodeId: string;
  draftText: string;
  sources: ReturnType<typeof useNodeInputSources>;
  creditsPerRun: number;
  onSpend: (amount: number) => void;
}) {
  const [findings, setFindings] = React.useState<AuditFinding[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // The auditor runs from the Citationist agent — bound on its own node-data
  // key so it's independent of the writer's Stylist selection.
  const auditAgent = useNodeAgent(nodeId, "citationist", "auditAgentId");

  const canRun = draftText.trim().length >= 20 && sources.length > 0;

  async function runAudit() {
    if (!canRun || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await auditDraft(
        draftText,
        sources,
        auditAgent ? agentSystemPrompt(auditAgent) : undefined,
      );
      setFindings(result);
      onSpend(creditsPerRun);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Audit failed.");
    } finally {
      setBusy(false);
    }
  }

  const counts = React.useMemo(() => {
    const c = { supported: 0, weak: 0, unsupported: 0 };
    for (const f of findings ?? []) c[f.status] += 1;
    return c;
  }, [findings]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {/* The auditor agent (overridable) — its persona/citation style
            governs the audit. */}
        <div className="mb-3">
          <AgentPicker
            nodeId={nodeId}
            archetype="citationist"
            dataKey="auditAgentId"
          />
        </div>

        <p className="flex items-start gap-1.5 px-1 text-[11px] leading-relaxed text-grey-500">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[var(--color-node-reader)]" />
          Johns checks each claim in your draft against the connected sources —
          so nothing goes unsupported.
        </p>

        {findings && findings.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <CountPill n={counts.supported} label="supported" cls="text-emerald-600" />
            <CountPill n={counts.weak} label="weak" cls="text-amber-600" />
            <CountPill n={counts.unsupported} label="unsupported" cls="text-red-600" />
          </div>
        )}

        {findings && (
          <ul className="mt-3 space-y-2">
            {findings.map((f, i) => {
              const meta = STATUS_META[f.status];
              const StatusIcon = meta.icon;
              const src = f.source ? sources[f.source - 1] : undefined;
              return (
                <li
                  key={i}
                  className="rounded-lg border border-grey-200 p-2.5"
                >
                  <div className="flex items-start gap-2">
                    <StatusIcon className={`mt-0.5 size-3.5 shrink-0 ${meta.cls}`} />
                    <div className="min-w-0">
                      <p className="text-[12px] leading-snug text-ink">{f.claim}</p>
                      {f.note && (
                        <p className="mt-1 text-[10.5px] leading-snug text-grey-400">
                          {f.note}
                        </p>
                      )}
                      {src && (
                        <p className="mt-1 truncate text-[10.5px] text-grey-500">
                          <span className="font-medium">[{f.source}]</span>{" "}
                          {src.title}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {findings && findings.length === 0 && (
          <p className="mt-3 rounded-lg border border-dashed border-grey-200 px-3 py-6 text-center text-[11px] text-grey-400">
            No distinct claims found to audit yet.
          </p>
        )}

        {error && (
          <p className="mt-3 flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50/50 p-2.5 text-[11px] leading-snug text-red-600">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            {error}
          </p>
        )}
      </div>

      <div className="border-t border-grey-100 p-3">
        {!canRun && (
          <p className="mb-2 text-[11px] leading-snug text-grey-400">
            {sources.length === 0
              ? "Connect sources to audit the draft against."
              : "Write a draft first, then run the audit."}
          </p>
        )}
        <button
          onClick={runAudit}
          disabled={!canRun || busy}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-ink py-2 text-xs font-medium text-paper transition-colors hover:bg-grey-800 disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="size-3.5" />
          )}
          {findings ? "Re-run audit" : "Audit citations"}
        </button>
      </div>
    </div>
  );
}

function CountPill({ n, label, cls }: { n: number; label: string; cls: string }) {
  return (
    <span className="rounded-full border border-grey-200 px-2 py-0.5 text-[10.5px] font-medium text-grey-600">
      <span className={`tabular-nums ${cls}`}>{n}</span> {label}
    </span>
  );
}
