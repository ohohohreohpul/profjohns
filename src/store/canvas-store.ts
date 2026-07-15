import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { temporal } from "zundo";
import {
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from "@xyflow/react";
import { NODE_DEFINITIONS, type NodeKind } from "@/lib/node-catalog";
import { DEFAULT_MODEL_ID } from "@/lib/models";
import {
  makeDefaultDoc,
  migrateBlocksToContent,
  type WritingDoc,
} from "@/lib/document";
import type { JSONContent } from "@tiptap/core";
import type { CitationStyle } from "@/lib/citation";
import type { PaperSource } from "@/lib/mock";
import { nextHighlightId, type Highlight } from "@/lib/highlight";

export interface ExtractResult {
  paperId: string;
  summary: string;
  keyClaims: string[];
}

const STORAGE_KEY = "lattice-canvas-v1";

/**
 * Per-canvas persistence. A project can hold many canvases, so the canvas
 * store namespaces its localStorage by the active canvas id — each board gets
 * its own key (`lattice-canvas-v1::<canvasId>`). The page sets the active
 * canvas before rehydrating.
 */
let activeCanvasId = "";

function keyFor(name: string): string {
  return activeCanvasId ? `${name}::${activeCanvasId}` : name;
}

export function setActiveCanvasId(id: string): void {
  activeCanvasId = id;
}

export function hasStoredCanvas(id: string): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(`${STORAGE_KEY}::${id}`) !== null;
}

export function clearStoredCanvas(id: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(`${STORAGE_KEY}::${id}`);
}

const canvasStorage = {
  getItem: (name: string): string | null =>
    typeof localStorage === "undefined" ? null : localStorage.getItem(keyFor(name)),
  setItem: (name: string, value: string): void => {
    if (typeof localStorage === "undefined") return;
    // Guard against the navigation race. On A->B navigation `activeCanvasId`
    // flips to B immediately, but the in-memory board is still A until its
    // async rehydrate/reset completes and `boardCanvasId` is marked B. Any
    // setState in that window would otherwise persist A's board under B's key,
    // making every canvas converge on one board. Only persist once the board
    // is confirmed to represent the active canvas (boardCanvasId === active).
    let board = "";
    try {
      board = useCanvasStore.getState().boardCanvasId;
    } catch {
      // store not yet constructed (initial hydration) — fall through.
    }
    if (board !== activeCanvasId) return;
    localStorage.setItem(keyFor(name), value);
  },
  removeItem: (name: string): void => {
    if (typeof localStorage !== "undefined") localStorage.removeItem(keyFor(name));
  },
};

export interface CanvasNodeData {
  kind: NodeKind;
  label: string;
  modelId: string;
  [key: string]: unknown;
}

export type CanvasNode = Node<CanvasNodeData>;

interface CanvasState {
  direction: string;
  nodes: CanvasNode[];
  edges: Edge[];
  creditsUsed: number;
  nextId: number;
  /** Node whose full-screen surface is currently open, if any. */
  openSurfaceNodeId: string | null;
  /** Source currently open in the in-app reader, if any. */
  readerPaper: PaperSource | null;
  /** Writing documents keyed by the node that owns them. */
  docs: Record<string, WritingDoc>;
  /** Source results keyed by the source node that fetched them. */
  sources: Record<string, PaperSource[]>;
  /** Reader highlights keyed by paper id. */
  highlights: Record<string, Highlight[]>;
  /** Extract results keyed by node id, then paper id. */
  extracts: Record<string, Record<string, ExtractResult>>;
  /** True once persisted state has been rehydrated on the client. */
  hasHydrated: boolean;
  /** True once the canvas has been initialized (seeded or started blank). */
  seeded: boolean;
  /** True once the onboarding hint has been dismissed. */
  hintSeen: boolean;
  /** Shell currently in focus mode, if any. */
  focusedShellId: string | null;
  /** The project this canvas belongs to (transient context, set on load). */
  projectId: string;
  /** Which canvas the in-memory board actually represents — set ONLY after a
   *  board finishes hydrating. DB sync gates saves on this so a board is never
   *  written to the wrong canvas during a navigation race. Transient. */
  boardCanvasId: string;

  setProjectId: (id: string) => void;
  setBoardCanvasId: (id: string) => void;
  setDirection: (direction: string) => void;
  setNodeSources: (nodeId: string, papers: PaperSource[]) => void;
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (
    kind: NodeKind,
    position: { x: number; y: number },
    data?: Record<string, unknown>,
  ) => string;
  removeNode: (nodeId: string) => void;
  /** Wrap a set of nodes in a new shell; returns the shell id. `bounds` is the
   *  selection's absolute rect (from React Flow's measured nodes) so the shell
   *  is sized correctly — node.measured isn't mirrored into this store. */
  groupNodes: (
    nodeIds: string[],
    bounds?: { x: number; y: number; width: number; height: number },
  ) => string | null;
  /** Move a node into a shell, or out to the top level when shellId is null. */
  reparentNode: (nodeId: string, shellId: string | null) => void;
  removeEdge: (edgeId: string) => void;
  /** Sever every connection touching a node (incoming and outgoing). */
  disconnectNode: (nodeId: string) => void;
  duplicateNode: (nodeId: string) => string | null;
  setNodeModel: (nodeId: string, modelId: string) => void;
  updateNodeData: (nodeId: string, partial: Record<string, unknown>) => void;
  spendCredits: (amount: number) => void;
  openSurface: (nodeId: string) => void;
  closeSurface: () => void;
  openReader: (paper: PaperSource) => void;
  closeReader: () => void;
  addHighlight: (paperId: string, text: string, paraIndex: number) => void;
  removeHighlight: (paperId: string, highlightId: string) => void;
  setNodeExtracts: (nodeId: string, extracts: Record<string, ExtractResult>) => void;

  ensureDoc: (nodeId: string, direction: string) => void;
  updateDocTitle: (nodeId: string, title: string) => void;
  /** Replace the document body (ProseMirror JSON) — the editor is the source. */
  setDocContent: (nodeId: string, content: JSONContent) => void;
  setDocStyle: (nodeId: string, style: CitationStyle) => void;
  setDocOutline: (nodeId: string, outline: string[]) => void;
  dismissHint: () => void;
  focusOnShell: (shellId: string) => void;
  unfocusShell: () => void;

  reset: (direction: string) => void;
  resetBlank: (direction: string) => void;
}

const SOURCE_HANDLE = "out";

// Approximate footprint for a not-yet-measured node, plus breathing room.
const NEW_W = 300;
const NEW_H = 220;
const GAP = 24;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function nodeBox(n: CanvasNode): Box {
  const w =
    n.measured?.width ??
    (typeof n.style?.width === "number" ? n.style.width : undefined) ??
    288;
  const h =
    n.measured?.height ??
    (typeof n.style?.height === "number" ? n.style.height : undefined) ??
    180;
  return { x: n.position.x, y: n.position.y, w, h };
}

function overlaps(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.w + GAP &&
    a.x + a.w + GAP > b.x &&
    a.y < b.y + b.h + GAP &&
    a.y + a.h + GAP > b.y
  );
}

/**
 * Find an open spot near `desired` so a new node doesn't land on top of an
 * existing one. Walks downward, then shifts to a fresh column. Group frames
 * are containers, so they're ignored as obstacles.
 */
function freeSpot(
  desired: { x: number; y: number },
  nodes: CanvasNode[],
): { x: number; y: number } {
  const obstacles = nodes
    .map(nodeBox);
  let pos = { ...desired };
  for (let i = 0; i < 240; i++) {
    const candidate: Box = { x: pos.x, y: pos.y, w: NEW_W, h: NEW_H };
    if (!obstacles.some((o) => overlaps(candidate, o))) return pos;
    pos = { x: pos.x, y: pos.y + NEW_H + GAP };
    if ((i + 1) % 6 === 0) {
      pos = { x: desired.x + ((i + 1) / 6) * (NEW_W + GAP), y: desired.y };
    }
  }
  return pos;
}

function kindDefaults(kind: NodeKind): Record<string, unknown> {
  switch (kind) {
    case "text":
      return { text: "" };
    case "shell":
      return { label: "Untitled section" };
    default:
      return {};
  }
}

function makeNode(
  id: string,
  kind: NodeKind,
  position: { x: number; y: number },
): CanvasNode {
  const base: CanvasNode = {
    id,
    type: kind,
    position,
    data: {
      kind,
      label: NODE_DEFINITIONS[kind].label,
      modelId: DEFAULT_MODEL_ID,
      ...kindDefaults(kind),
    },
  };
  if (kind === "writing") {
    return { ...base, style: { width: 540 } };
  }
  if (kind === "shell") {
    return { ...base, style: { width: 480, height: 320 } };
  }
  return base;
}

/**
 * React Flow requires a parent node to appear BEFORE its children in the
 * array; otherwise children render at the wrong position (or not at all).
 * Returns a stably-reordered copy that always satisfies that invariant.
 */
function orderByParent(nodes: CanvasNode[]): CanvasNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: CanvasNode[] = [];
  const seen = new Set<string>();
  function visit(node: CanvasNode) {
    if (seen.has(node.id)) return;
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent && !seen.has(parent.id)) visit(parent);
    seen.add(node.id);
    out.push(node);
  }
  for (const n of nodes) visit(n);
  return out;
}

/** Absolute (canvas) position of a node, resolving one level of parenting. */
function absolutePosition(
  node: CanvasNode,
  nodes: CanvasNode[],
): { x: number; y: number } {
  const parent = node.parentId
    ? nodes.find((n) => n.id === node.parentId)
    : undefined;
  return parent
    ? { x: node.position.x + parent.position.x, y: node.position.y + parent.position.y }
    : { x: node.position.x, y: node.position.y };
}

export const useCanvasStore = create<CanvasState>()(
  temporal(
    persist(
      (set, get) => ({
      direction: "",
      nodes: [],
      edges: [],
      creditsUsed: 0,
      nextId: 1,
      openSurfaceNodeId: null,
      readerPaper: null,
      docs: {},
      sources: {},
      highlights: {},
      extracts: {},
      hasHydrated: false,
      seeded: false,
      hintSeen: false,
      focusedShellId: null,
      projectId: "",
      boardCanvasId: "",

      setProjectId: (id) => set({ projectId: id }),
      setBoardCanvasId: (id) => set({ boardCanvasId: id }),
      setDirection: (direction) => set({ direction }),

      setNodeSources: (nodeId, papers) =>
        set((state) => ({
          sources: { ...state.sources, [nodeId]: papers },
        })),

  onNodesChange: (changes) =>
    set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) })),

  onEdgesChange: (changes) =>
    set((state) => ({ edges: applyEdgeChanges(changes, state.edges) })),

  onConnect: (connection) =>
    set((state) => ({
      edges: addEdge(
        { ...connection, type: "action", animated: true },
        state.edges,
      ),
    })),

  addNode: (kind, position, data) => {
    const id = `n${get().nextId}`;
    // Group frames may overlap (they contain other nodes); everything else
    // gets nudged to a free spot near the requested position.
    const placed = freeSpot(position, get().nodes);
    const node = makeNode(id, kind, placed);
    const withData = data
      ? { ...node, data: { ...node.data, ...data } }
      : node;
    set((state) => ({
      nodes: [...state.nodes, withData],
      nextId: state.nextId + 1,
    }));
    return id;
  },

  removeNode: (nodeId) =>
    set((state) => {
      const target = state.nodes.find((n) => n.id === nodeId);
      // Removing a shell frees its children (re-absolutized + detached) rather
      // than leaving them orphaned with a dangling parentId.
      const nodes = state.nodes
        .filter((n) => n.id !== nodeId)
        .map((n) =>
          target && n.parentId === nodeId
            ? {
                ...n,
                parentId: undefined,
                position: {
                  x: n.position.x + target.position.x,
                  y: n.position.y + target.position.y,
                },
              }
            : n,
        );
      return {
        nodes: orderByParent(nodes),
        edges: state.edges.filter(
          (e) => e.source !== nodeId && e.target !== nodeId,
        ),
      };
    }),

  // Wrap a selection in a new shell. One place owns grouping: it sizes the
  // shell to the selection's bounding box, reparents each node with positions
  // relative to the shell, and keeps the parent-before-child ordering.
  groupNodes: (nodeIds, bounds) => {
    let shellId: string | null = null;
    set((state) => {
      const selected = state.nodes.filter(
        (n) => nodeIds.includes(n.id) && n.data.kind !== "shell",
      );
      if (selected.length < 1) return {};

      // Prefer the measured rect from React Flow (passed in); fall back to
      // store positions + default sizes when it isn't available.
      let minX: number, minY: number, maxX: number, maxY: number;
      if (bounds) {
        minX = bounds.x;
        minY = bounds.y;
        maxX = bounds.x + bounds.width;
        maxY = bounds.y + bounds.height;
      } else {
        minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;
        for (const n of selected) {
          const a = absolutePosition(n, state.nodes);
          minX = Math.min(minX, a.x);
          minY = Math.min(minY, a.y);
          maxX = Math.max(maxX, a.x + (n.measured?.width ?? 288));
          maxY = Math.max(maxY, a.y + (n.measured?.height ?? 180));
        }
      }

      const PAD_X = 24, HEAD = 56, PAD_B = 24;
      const shellPos = { x: minX - PAD_X, y: minY - HEAD };
      const id = `n${state.nextId}`;
      shellId = id;
      const shell: CanvasNode = {
        ...makeNode(id, "shell", shellPos),
        selected: true,
        style: {
          width: Math.max(320, maxX - minX + PAD_X * 2),
          height: Math.max(200, maxY - minY + HEAD + PAD_B),
        },
      };

      const selIds = new Set(selected.map((n) => n.id));
      const updated = state.nodes.map((n) => {
        if (!selIds.has(n.id)) return n;
        const a = absolutePosition(n, state.nodes);
        return {
          ...n,
          parentId: id,
          selected: false,
          position: { x: a.x - shellPos.x, y: a.y - shellPos.y },
        };
      });

      return {
        nodes: orderByParent([...updated, shell]),
        nextId: state.nextId + 1,
      };
    });
    return shellId;
  },

  // Move a node into a shell (shellId) or out to the top level (null),
  // converting between relative and absolute coordinates so it never jumps.
  reparentNode: (nodeId, shellId) =>
    set((state) => {
      const node = state.nodes.find((n) => n.id === nodeId);
      if (!node || node.id === shellId || node.parentId === shellId) return {};
      const abs = absolutePosition(node, state.nodes);

      let next: CanvasNode;
      if (shellId) {
        const shell = state.nodes.find((n) => n.id === shellId);
        if (!shell || shell.data.kind !== "shell") return {};
        next = {
          ...node,
          parentId: shellId,
          position: { x: abs.x - shell.position.x, y: Math.max(40, abs.y - shell.position.y) },
        };
      } else {
        next = { ...node, parentId: undefined, position: abs };
      }

      const nodes = state.nodes.map((n) => (n.id === nodeId ? next : n));
      return { nodes: orderByParent(nodes) };
    }),

  removeEdge: (edgeId) =>
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== edgeId),
    })),

  disconnectNode: (nodeId) =>
    set((state) => ({
      edges: state.edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId,
      ),
    })),

  duplicateNode: (nodeId) => {
    const source = get().nodes.find((n) => n.id === nodeId);
    if (!source) return null;
    const id = `n${get().nextId}`;
    const placed = freeSpot(
      { x: source.position.x + 32, y: source.position.y + 32 },
      get().nodes,
    );
    // Deep-clone data so the copy never shares references with the original.
    const clone = {
      ...source,
      id,
      position: placed,
      selected: true,
      data: structuredClone(source.data),
    };
    set((state) => ({
      nodes: [
        ...state.nodes.map((n) => ({ ...n, selected: false })),
        clone,
      ],
      nextId: state.nextId + 1,
    }));
    return id;
  },

  setNodeModel: (nodeId, modelId) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, modelId } }
          : node,
      ),
    })),

  updateNodeData: (nodeId, partial) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...partial } }
          : node,
      ),
    })),

  spendCredits: (amount) =>
    set((state) => ({ creditsUsed: state.creditsUsed + amount })),

  openSurface: (nodeId) => set({ openSurfaceNodeId: nodeId }),

  closeSurface: () => set({ openSurfaceNodeId: null }),

  openReader: (paper) => set({ readerPaper: paper }),

  closeReader: () => set({ readerPaper: null }),

  addHighlight: (paperId, text, paraIndex) =>
    set((state) => {
      const existing = state.highlights[paperId] ?? [];
      const highlight: Highlight = { id: nextHighlightId(), text, paraIndex };
      return {
        highlights: {
          ...state.highlights,
          [paperId]: [...existing, highlight],
        },
      };
    }),

  removeHighlight: (paperId, highlightId) =>
    set((state) => ({
      highlights: {
        ...state.highlights,
        [paperId]: (state.highlights[paperId] ?? []).filter(
          (h) => h.id !== highlightId,
        ),
      },
    })),

  setNodeExtracts: (nodeId, extracts) =>
    set((state) => ({
      extracts: { ...state.extracts, [nodeId]: extracts },
    })),

  ensureDoc: (nodeId, direction) =>
    set((state) =>
      state.docs[nodeId]
        ? state
        : { docs: { ...state.docs, [nodeId]: makeDefaultDoc(direction) } },
    ),

  updateDocTitle: (nodeId, title) =>
    set((state) => {
      const doc = state.docs[nodeId];
      if (!doc) return state;
      return { docs: { ...state.docs, [nodeId]: { ...doc, title } } };
    }),

  setDocContent: (nodeId, content) =>
    set((state) => {
      const doc = state.docs[nodeId];
      if (!doc) return state;
      return { docs: { ...state.docs, [nodeId]: { ...doc, content } } };
    }),

  setDocStyle: (nodeId, style) =>
        set((state) => {
          const doc = state.docs[nodeId];
          if (!doc) return state;
          return { docs: { ...state.docs, [nodeId]: { ...doc, style } } };
        }),

      setDocOutline: (nodeId, outline) =>
        set((state) => {
          const doc = state.docs[nodeId];
          if (!doc) return state;
          return { docs: { ...state.docs, [nodeId]: { ...doc, outline } } };
        }),

      dismissHint: () => set({ hintSeen: true }),

      focusOnShell: (shellId) => set({ focusedShellId: shellId }),
      unfocusShell: () => set({ focusedShellId: null }),

reset: (direction) =>
        set({
          direction,
          creditsUsed: 0,
          nextId: 3,
          seeded: true,
          openSurfaceNodeId: null,
          readerPaper: null,
          docs: {},
          extracts: {},
          sources: {},
          nodes: [
            makeNode("n1", "explorer", { x: 100, y: 120 }),
            makeNode("n2", "writing", { x: 540, y: 140 }),
          ],
          edges: [
            {
              id: "e1-2",
              source: "n1",
              sourceHandle: "out",
              target: "n2",
              type: "action",
            },
          ],
        }),

      resetBlank: (direction) =>
        set({
          direction,
          creditsUsed: 0,
          nextId: 1,
          seeded: true,
          openSurfaceNodeId: null,
          readerPaper: null,
          docs: {},
          sources: {},
          highlights: {},
          extracts: {},
          nodes: [],
          edges: [],
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => canvasStorage),
      skipHydration: true,
      partialize: (state) => ({
        direction: state.direction,
        nodes: state.nodes,
        edges: state.edges,
        creditsUsed: state.creditsUsed,
        nextId: state.nextId,
        docs: state.docs,
        sources: state.sources,
        highlights: state.highlights,
        extracts: state.extracts,
        seeded: state.seeded,
        hintSeen: state.hintSeen,
      }),
      onRehydrateStorage: () => (state) => {
        // Migrate any document still on the legacy block[] shape to ProseMirror
        // JSON so existing drafts survive the editor change. Transparent.
        if (state?.docs) {
          let changed = false;
          const docs: Record<string, WritingDoc> = {};
          for (const [id, doc] of Object.entries(state.docs)) {
            const legacy = doc as WritingDoc & {
              blocks?: { type?: "heading" | "paragraph"; text?: string }[];
              citationIds?: string[];
            };
            if (!legacy.content && legacy.blocks) {
              changed = true;
              docs[id] = {
                title: legacy.title ?? "",
                content: migrateBlocksToContent(legacy.blocks),
                style: legacy.style,
                outline: legacy.outline ?? [],
              };
            } else {
              docs[id] = doc;
            }
          }
          if (changed) useCanvasStore.setState({ docs });
        }
        useCanvasStore.setState({ hasHydrated: true });
      },
    },
    ),
    {
      // Undo/redo covers canvas structure & content — not transient UI flags.
      // `docs` is intentionally excluded: the block editor has native text
      // undo, and tracking it here would add a history step per keystroke.
      limit: 50,
      partialize: (state) => ({
        direction: state.direction,
        creditsUsed: state.creditsUsed,
        nextId: state.nextId,
        sources: state.sources,
        highlights: state.highlights,
        extracts: state.extracts,
        // Strip volatile fields (measured size, selection, drag flag) so
        // React Flow's measurement/selection changes don't create undo steps.
        nodes: state.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data,
          style: n.style,
          zIndex: n.zIndex,
        })),
        edges: state.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          type: e.type,
        })),
      }),
      // Only record when the tracked content actually changes — skips React
      // Flow's measurement/selection sets that would otherwise flood history
      // and clear the redo stack.
      equality: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    },
  ),
);
