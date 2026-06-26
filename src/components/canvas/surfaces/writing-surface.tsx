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
  type Icon,
} from "@phosphor-icons/react";
import { SurfaceShell } from "./surface-shell";
import { WritingDocument } from "./writing-document";
import { ExportMenu } from "./export-menu";
import { StyleSelector, ReferencesPanel } from "./references-panel";
import { getModel } from "@/lib/models";
import { useCanvasStore } from "@/store/canvas-store";
import { useNodeInputSources } from "@/store/use-sources";
import { writeFromSources, editText } from "@/lib/ai-client";
import { formatInText, DEFAULT_STYLE } from "@/lib/citation";
import { getDocEditor } from "@/components/editor/doc-editor";
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
  const sources = useNodeInputSources(nodeId);

  const [instruction, setInstruction] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [busyLabel, setBusyLabel] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<"ai" | "sources" | "outline">("ai");

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
      const answer = await writeFromSources(instr, sources, draftText);
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
              label="AI writer"
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
          </div>

          {tab === "ai" && (
            <AiPanel
              model={model}
              sources={sources}
              draftEmpty={!draftText.trim()}
              busy={busy}
              busyLabel={busyLabel}
              error={error}
              instruction={instruction}
              onInstruction={setInstruction}
              onRunWrite={runWrite}
              onApplyEdit={applyEdit}
            />
          )}
          {tab === "sources" && <SourcesPanel nodeId={nodeId} />}
          {tab === "outline" && (
            <OutlinePanel
              outline={outline}
              onChange={(o) => setDocOutline(nodeId, o)}
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

function AiPanel({
  model,
  sources,
  draftEmpty,
  busy,
  busyLabel,
  error,
  instruction,
  onInstruction,
  onRunWrite,
  onApplyEdit,
}: {
  model: ReturnType<typeof getModel>;
  sources: ReturnType<typeof useNodeInputSources>;
  draftEmpty: boolean;
  busy: boolean;
  busyLabel: string;
  error: string | null;
  instruction: string;
  onInstruction: (v: string) => void;
  onRunWrite: (preset?: string) => void;
  onApplyEdit: (instr: string, label: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-3">
        <p className="flex items-center gap-1 px-1 text-[11px] text-grey-500">
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
