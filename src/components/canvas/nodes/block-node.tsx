"use client";

import * as React from "react";
import { TextT as Type, Code as Code2, TextHTwo as Heading2, TextB as Bold, TextItalic as Italic, TextStrikethrough as Strikethrough, GitBranch, CircleNotch as Loader2 } from "@phosphor-icons/react";
import { type CanvasNodeProps } from "../nodes/node-shell";
import { useCanvasStore } from "@/store/canvas-store";
import { generateDiagram } from "@/lib/ai-client";
import { cn } from "@/lib/utils";

type BlockVariant = "text" | "code" | "heading" | "diagram";

const VARIANT_ITEMS: { id: BlockVariant; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "text", label: "Text", icon: Type },
  { id: "heading", label: "Heading", icon: Heading2 },
  { id: "code", label: "Code", icon: Code2 },
  { id: "diagram", label: "Diagram", icon: Code2 },
];

function focusEnd(el: HTMLElement) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
}

export function BlockNode({ id, data, selected }: CanvasNodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const ref = React.useRef<HTMLDivElement>(null);

  const variant = (data.variant as BlockVariant) ?? "text";
  const text = (data.text as string) ?? "";
  const html = (data.html as string) ?? "";

  const [slashOpen, setSlashOpen] = React.useState(false);
  const [slashPos, setSlashPos] = React.useState({ x: 0, y: 0 });
  const [formatMenu, setFormatMenu] = React.useState<{ x: number; y: number } | null>(null);

  // Seed DOM once
  React.useEffect(() => {
    if (!ref.current) return;
    if (html) ref.current.innerHTML = html;
    else if (ref.current.innerText !== text) ref.current.innerText = text;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleInput(e: React.FormEvent<HTMLDivElement>) {
    const el = e.currentTarget;

    // Slash command detection
    const txt = (el as HTMLElement).innerText;
    if (txt === "/" || txt.endsWith("\n/") || txt.startsWith("/")) {
      const rect = el.getBoundingClientRect();
      setSlashPos({ x: rect.left + 8, y: rect.top - 8 });
      setSlashOpen(true);
    } else {
      setSlashOpen(false);
    }

    updateNodeData(id, {
      text: (el as HTMLElement).innerText,
      html: (el as HTMLElement).innerHTML,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Create a new block below
      const store = useCanvasStore.getState();
      const self = store.nodes.find((n) => n.id === id);
      if (!self) return;
      const newId = store.addNode("block", {
        x: self.position.x,
        y: self.position.y + (self.measured?.height ?? 40) + 8,
      });
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-id="${newId}"] [contenteditable]`) as HTMLElement | null;
        if (el) focusEnd(el);
      });
    } else if (e.key === "Backspace" && !(e.currentTarget as HTMLElement).innerText.trim()) {
      e.preventDefault();
      removeNode(id);
    }
  }

  function handleMouseUp() {
    const sel = window.getSelection();
    if (!sel || !sel.toString().trim()) {
      setFormatMenu(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setFormatMenu({ x: rect.left + rect.width / 2, y: rect.top });
  }

  function execFormat(cmd: string) {
    document.execCommand(cmd);
    setFormatMenu(null);
  }

  function pickVariant(v: BlockVariant) {
    updateNodeData(id, { variant: v });
    setSlashOpen(false);
  }

  const isCode = variant === "code";
  const isHeading = variant === "heading";
  const isDiagram = variant === "diagram";

  // Render Mermaid diagram
  const [svg, setSvg] = React.useState("");
  const [diagramBusy, setDiagramBusy] = React.useState(false);
  const diagramRef = React.useRef(false);

  React.useEffect(() => {
    if (!isDiagram || !text.trim() || diagramRef.current) return;
    diagramRef.current = true;
    setDiagramBusy(true);
    import("mermaid").then((mermaid) => {
      mermaid.default.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose" });
      mermaid.default.render(`mermaid-${id}`, text).then(({ svg: s }) => {
        setSvg(s);
        setDiagramBusy(false);
      }).catch(() => setDiagramBusy(false));
    });
  }, [isDiagram, text, id]);

  return (
    <div className="animate-node-in group/block relative min-w-[180px]">
      {isDiagram ? (
        <div className="min-h-[60px] min-w-[200px]">
          {diagramBusy ? (
            <div className="flex items-center gap-2 text-[12px] text-grey-500 py-2">
              <Loader2 className="size-4 animate-spin" /> Rendering diagram…
            </div>
          ) : svg ? (
            <div
              className="[&>svg]:max-w-full [&>svg]:h-auto"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <p className="py-2 text-[12px] text-grey-500">Invalid diagram syntax</p>
          )}
        </div>
      ) : (
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          data-id={id}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onMouseUp={handleMouseUp}
          className={cn(
            "nodrag block-editor min-h-[28px] cursor-text rounded-md px-2 py-1 text-[14px] leading-relaxed outline-none transition-colors",
            "hover:bg-grey-50/60 focus:bg-grey-50/80",
            isCode
              ? "font-mono text-[13px] text-grey-700 bg-grey-100/50"
              : isHeading
                ? "text-[17px] font-semibold tracking-tight text-ink"
                : "text-grey-800",
            !text.trim() && !isCode && "text-grey-500",
          )}
          data-placeholder={isHeading ? "Heading" : isCode ? "// code" : "Type / for menu"}
        />
      )}

      {/* Slash menu */}
      {slashOpen && (
        <div
          className="nodrag animate-float-in fixed z-50"
          style={{ left: slashPos.x, top: slashPos.y - 140 }}
        >
          <div className="flex flex-col rounded-lg border border-grey-200 bg-paper p-1 shadow-lift">
            <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-grey-500">Turn into</p>
            {VARIANT_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickVariant(item.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors hover:bg-grey-100",
                    variant === item.id ? "text-ink" : "text-grey-600",
                  )}
                >
                  <Icon className="size-3.5 text-grey-500" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Format toolbar */}
      {formatMenu && (
        <div
          style={{ left: formatMenu.x, top: formatMenu.y - 40 }}
          className="nodrag animate-float-in fixed z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-grey-200 bg-paper px-1 py-0.5 shadow-lift"
        >
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("bold")} className="grid size-6 place-items-center rounded text-grey-500 hover:bg-grey-100 hover:text-ink"><Bold className="size-3" /></button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("italic")} className="grid size-6 place-items-center rounded text-grey-500 hover:bg-grey-100 hover:text-ink"><Italic className="size-3" /></button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("strikeThrough")} className="grid size-6 place-items-center rounded text-grey-500 hover:bg-grey-100 hover:text-ink"><Strikethrough className="size-3" /></button>
          <div className="mx-0.5 h-4 w-px bg-grey-200" />
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("insertText")} className="grid size-6 place-items-center rounded text-grey-500 hover:bg-grey-100 hover:text-ink"><Code2 className="size-3" /></button>
        </div>
      )}
    </div>
  );
}