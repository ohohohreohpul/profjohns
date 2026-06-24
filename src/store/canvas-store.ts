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
  makeBlock,
  makeDefaultDoc,
  sanitizeHtml,
  type BlockType,
  type WritingDoc,
} from "@/lib/document";
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
    if (typeof localStorage !== "undefined") localStorage.setItem(keyFor(name), value);
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

  setProjectId: (id: string) => void;
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
  updateBlockText: (
    nodeId: string,
    blockId: string,
    text: string,
    html?: string,
  ) => void;
  setBlockType: (nodeId: string, blockId: string, type: BlockType) => void;
  addBlockAfter: (
    nodeId: string,
    afterBlockId: string,
    type: BlockType,
  ) => string;
  removeBlock: (nodeId: string, blockId: string) => void;
  appendBlock: (nodeId: string, type: BlockType, text: string) => string;
  setDocPlainText: (nodeId: string, text: string) => void;
  setDocStyle: (nodeId: string, style: CitationStyle) => void;
  addCitation: (nodeId: string, paperId: string) => void;
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

      setProjectId: (id) => set({ projectId: id }),
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
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId,
      ),
    })),

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

  updateBlockText: (nodeId, blockId, text, html) =>
    set((state) => {
      const doc = state.docs[nodeId];
      if (!doc) return state;
      const cleanHtml = html === undefined ? undefined : sanitizeHtml(html);
      const blocks = doc.blocks.map((b) =>
        b.id === blockId ? { ...b, text, html: cleanHtml } : b,
      );
      return { docs: { ...state.docs, [nodeId]: { ...doc, blocks } } };
    }),

  setBlockType: (nodeId, blockId, type) =>
    set((state) => {
      const doc = state.docs[nodeId];
      if (!doc) return state;
      const blocks = doc.blocks.map((b) =>
        b.id === blockId ? { ...b, type } : b,
      );
      return { docs: { ...state.docs, [nodeId]: { ...doc, blocks } } };
    }),

  addBlockAfter: (nodeId, afterBlockId, type) => {
    const block = makeBlock(type);
    set((state) => {
      const doc = state.docs[nodeId];
      if (!doc) return state;
      const index = doc.blocks.findIndex((b) => b.id === afterBlockId);
      const blocks = [...doc.blocks];
      blocks.splice(index + 1, 0, block);
      return { docs: { ...state.docs, [nodeId]: { ...doc, blocks } } };
    });
    return block.id;
  },

  removeBlock: (nodeId, blockId) =>
    set((state) => {
      const doc = state.docs[nodeId];
      if (!doc || doc.blocks.length <= 1) return state;
      const blocks = doc.blocks.filter((b) => b.id !== blockId);
      return { docs: { ...state.docs, [nodeId]: { ...doc, blocks } } };
    }),

  appendBlock: (nodeId, type, text) => {
    const block = makeBlock(type, text);
    set((state) => {
      const doc = state.docs[nodeId];
      if (!doc) return state;
      return {
        docs: {
          ...state.docs,
          [nodeId]: { ...doc, blocks: [...doc.blocks, block] },
        },
      };
    });
    return block.id;
  },

  setDocPlainText: (nodeId, text) =>
    set((state) => {
      const doc = state.docs[nodeId];
      if (!doc) return state;
      const chunks = text.split(/\n\n+/);
      const blocks = chunks
        .filter((c) => c.trim())
        .map((c) => makeBlock("paragraph", c.trim()));
      if (blocks.length === 0) {
        blocks.push(makeBlock("paragraph", ""));
      }
      return { docs: { ...state.docs, [nodeId]: { ...doc, blocks } } };
    }),

  setDocStyle: (nodeId, style) =>
        set((state) => {
          const doc = state.docs[nodeId];
          if (!doc) return state;
          return { docs: { ...state.docs, [nodeId]: { ...doc, style } } };
        }),

      addCitation: (nodeId, paperId) =>
        set((state) => {
          const doc = state.docs[nodeId];
          if (!doc) return state;
          const current = doc.citationIds ?? [];
          if (current.includes(paperId)) return state;
          return {
            docs: {
              ...state.docs,
              [nodeId]: { ...doc, citationIds: [...current, paperId] },
            },
          };
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
      onRehydrateStorage: () => () => {
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
