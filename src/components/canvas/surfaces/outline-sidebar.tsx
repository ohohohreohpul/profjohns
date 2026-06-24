"use client";

import * as React from "react";
import { useReactFlow } from "@xyflow/react";
import { TreeStructure as ListTree, SidebarSimple as PanelLeftClose, SidebarSimple as PanelLeftOpen } from "@phosphor-icons/react";
import { useCanvasStore } from "@/store/canvas-store";
import { NODE_DEFINITIONS, type NodeKind } from "@/lib/node-catalog";
import type { WritingDoc } from "@/lib/document";
import { cn } from "@/lib/utils";

interface OutlineNode {
  id: string;
  kind: NodeKind;
  label: string;
  children: OutlineNode[];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** A readable, content-derived label per node type — not the raw kind. */
function labelFor(
  node: { id: string; data: Record<string, unknown> },
  docs: Record<string, WritingDoc>,
): string {
  const d = node.data;
  const kind = d.kind as NodeKind;
  const def = NODE_DEFINITIONS[kind];

  switch (kind) {
    case "explorer":
      return (d.topic as string)?.trim() || def.label;
    case "writing":
      return docs[node.id]?.title?.trim() || "Untitled draft";
    case "media": {
      const m = d.media as { caption?: string; name?: string } | undefined;
      return m?.caption?.trim() || m?.name?.trim() || def.label;
    }
    case "paper": {
      const p = d.paper as { title?: string } | undefined;
      return p?.title?.trim() || def.label;
    }
    case "shell":
      return (d.label as string)?.trim() || def.label;
    case "block":
    case "text": {
      const text = (d.text as string)?.trim() || stripHtml((d.html as string) ?? "");
      return text ? text.slice(0, 48) : def.label;
    }
    default:
      return def.label;
  }
}

function buildTree(
  nodes: {
    id: string;
    parentId?: string | null;
    data: { kind: string; [key: string]: unknown };
  }[],
  docs: Record<string, WritingDoc>,
): OutlineNode[] {
  const byId = new Map<string, OutlineNode>();
  const roots: OutlineNode[] = [];

  for (const n of nodes) {
    byId.set(n.id, {
      id: n.id,
      kind: n.data.kind as NodeKind,
      label: labelFor(n, docs),
      children: [],
    });
  }

  for (const n of nodes) {
    const node = byId.get(n.id);
    if (!node) continue;
    if (n.parentId && byId.has(n.parentId)) {
      byId.get(n.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function TreeItem({
  node,
  depth,
  activeId,
  onSelect,
}: {
  node: OutlineNode;
  depth: number;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const def = NODE_DEFINITIONS[node.kind];
  const Icon = def.icon;
  const isActive = activeId === node.id;

  return (
    <div>
      <button
        onClick={() => onSelect(node.id)}
        title={node.label}
        className={cn(
          "group/item flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left text-[12px] transition-colors",
          isActive ? "bg-grey-100 font-medium text-ink" : "text-grey-600 hover:bg-grey-50",
        )}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <span
          className="grid size-5 shrink-0 place-items-center rounded-md"
          style={{
            color: def.accent,
            backgroundColor: `color-mix(in oklch, ${def.accent} 12%, white)`,
          }}
        >
          <Icon className="size-3" />
        </span>
        <span className="line-clamp-1 flex-1">{node.label}</span>
      </button>
      {node.children.map((child) => (
        <TreeItem
          key={child.id}
          node={child}
          depth={depth + 1}
          activeId={activeId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export function OutlineSidebar() {
  const nodes = useCanvasStore((s) => s.nodes);
  const docs = useCanvasStore((s) => s.docs);
  const focusedShellId = useCanvasStore((s) => s.focusedShellId);
  const unfocusShell = useCanvasStore((s) => s.unfocusShell);
  const { fitView } = useReactFlow();
  const [open, setOpen] = React.useState(false);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  // Every node belongs in the outline — it should mirror the canvas exactly.
  const tree = React.useMemo(() => buildTree(nodes, docs), [nodes, docs]);
  const count = nodes.length;

  function handleSelect(id: string) {
    setActiveId(id);
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    if (
      focusedShellId &&
      node.parentId !== focusedShellId &&
      node.id !== focusedShellId
    ) {
      unfocusShell();
    }
    setTimeout(() => {
      fitView({ nodes: [node], padding: 0.5, duration: 300, maxZoom: 1.5 });
    }, 50);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Show outline"
        title="Outline"
        className="absolute left-4 top-20 z-20 grid size-9 place-items-center rounded-xl border border-grey-200 bg-paper/90 shadow-lift backdrop-blur transition-colors hover:bg-grey-50"
      >
        <ListTree className="size-4 text-grey-500" />
      </button>
    );
  }

  return (
    <aside className="absolute left-4 top-20 z-20 flex max-h-[calc(100%-6rem)] w-60 flex-col overflow-hidden rounded-2xl border border-grey-200 bg-paper/90 shadow-lift backdrop-blur">
      <div className="flex shrink-0 items-center gap-2 px-3 py-2.5">
        <ListTree className="size-4 text-grey-500" />
        <span className="text-xs font-semibold text-ink">Outline</span>
        <span className="rounded-full bg-grey-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-grey-500">
          {count}
        </span>
        <button
          onClick={() => setOpen(false)}
          aria-label="Hide outline"
          className="ml-auto grid size-6 place-items-center rounded-md text-grey-400 transition-colors hover:bg-grey-100 hover:text-ink"
        >
          <PanelLeftClose className="size-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
        {count === 0 ? (
          <p className="px-2 py-6 text-center text-[11px] leading-relaxed text-grey-400">
            Nothing on the canvas yet. Add a node from the toolbar and it shows
            up here.
          </p>
        ) : (
          tree.map((node) => (
            <TreeItem
              key={node.id}
              node={node}
              depth={0}
              activeId={activeId}
              onSelect={handleSelect}
            />
          ))
        )}
      </div>
    </aside>
  );
}
