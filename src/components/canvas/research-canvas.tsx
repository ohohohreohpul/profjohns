"use client";

import * as React from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  SelectionMode,
  useReactFlow,
  getNodesBounds,
  type OnConnectStart,
  type OnConnectEnd,
} from "@xyflow/react";
import { useCanvasStore } from "@/store/canvas-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { SUGGESTED_NEXT, NODE_ORDER, type NodeKind } from "@/lib/node-catalog";
import { DEFAULT_MODEL_ID, getModel } from "@/lib/models";
import { cn } from "@/lib/utils";
import { Package as Container, ArrowCounterClockwise as Undo } from "@phosphor-icons/react";
import { ExplorerNode } from "./nodes/explorer-node";
import { ProcessorNode } from "./nodes/processor-node";
import { BlockNode } from "./nodes/block-node";
import { ShellNode } from "./nodes/shell-node";
import { WritingNode } from "./nodes/writing-node";
import { TextNode } from "./nodes/text-node";
import { AssistantNode } from "./nodes/assistant-node";
import { PaperNode } from "./nodes/paper-node";
import { MediaNode } from "./nodes/media-node";
import { LibraryNode } from "./nodes/library-node";
import { LinkNode } from "./nodes/link-node";
import { InsightNode } from "./nodes/insight-node";
import { ThemeNode } from "./nodes/theme-node";
import { FigureNode } from "./nodes/figure-node";
import { ChartNode } from "./nodes/chart-node";
import { storeFigureImage } from "@/lib/figure-storage";
import { looksTabular, parseTable, suggestChart } from "@/lib/chart-data";
import { chartFromTable } from "@/components/board/cards/chart-card";
import { isPdfFile, uploadPdf, PdfUploadError } from "@/lib/pdf-upload";
import { ActionEdge } from "./edges/action-edge";
import { Toolbar } from "./toolbar";
import { ConnectionMenu, type SpawnRequest } from "./connection-menu";
import { NodeMenu } from "./node-menu";
import { FocusOverlay } from "./surfaces/focus-overlay";
import { OutlineSidebar } from "./surfaces/outline-sidebar";
import { PAPER_DND_MIME } from "@/lib/dnd";
import type { PaperSource } from "@/lib/mock";

const nodeTypes = {
  explorer: ExplorerNode,
  processor: ProcessorNode,
  block: BlockNode,
  text: TextNode,
  shell: ShellNode,
  writing: WritingNode,
  assistant: AssistantNode,
  paper: PaperNode,
  media: MediaNode,
  library: LibraryNode,
  link: LinkNode,
  insight: InsightNode,
  theme: ThemeNode,
  figure: FigureNode,
  chart: ChartNode,
};

/** An image file -> a Figure node at `pos` (stored privately when signed in). */
function addFigureFromFile(file: File, pos: { x: number; y: number }, origin: "upload" | "paste"): void {
  const { addNode, updateNodeData } = useCanvasStore.getState();
  const id = addNode("figure", { x: pos.x - 144, y: pos.y - 40 });
  storeFigureImage(file)
    .then((image) => updateNodeData(id, { card: { image, caption: "", origin } }))
    .catch((err: unknown) => {
      // The node stays as an empty Figure dropzone so the user can retry.
      console.error("[canvas] couldn't store the dropped image", err);
    });
}

const edgeTypes = { action: ActionEdge };

function CanvasInner() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    spendCredits,
    setNodeSources,
    groupNodes,
    reparentNode,
  } = useCanvasStore();

  // Confine dragging to each node's header handle (`.node-drag-handle` in
  // NodeShell) without disabling selection: `dragHandle` restricts only the
  // drag start, so clicking anywhere on the card still selects. Shell + block
  // nodes don't use NodeShell, so they stay draggable from their whole frame.
  const flowNodes = React.useMemo(
    () =>
      nodes.map((n) =>
        n.data?.kind === "shell" || n.data?.kind === "block"
          ? n
          : { ...n, dragHandle: ".node-drag-handle" },
      ),
    [nodes],
  );

  const {
    screenToFlowPosition,
    zoomIn,
    zoomOut,
    fitView,
    getNodes,
    getNode,
    getZoom,
    setCenter,
    setNodes,
  } = useReactFlow();
  const dragOrigin = React.useRef<string | null>(null);
  const [spawn, setSpawn] = React.useState<SpawnRequest | null>(null);
  const [paneMenu, setPaneMenu] = React.useState<{
    screen: { x: number; y: number };
    flow: { x: number; y: number };
  } | null>(null);
  const [isSpaceHeld, setSpaceHeld] = React.useState(false);
  // Active pointer tool — "hand" pans on left-drag for users without a
  // trackpad/multitouch; "select" box-selects (Space still pans temporarily).
  const [tool, setTool] = React.useState<"select" | "hand">("select");
  const selectedCount = nodes.filter((n) => n.selected).length;
  const isPanning = isSpaceHeld || tool === "hand";

  // "Group into section" — group the current selection. All the bounding-box,
  // reparenting, and parent-ordering work lives in the store's groupNodes.
  function handleWrapSelection() {
    const selected = getNodes().filter(
      (n) => n.selected && n.data.kind !== "shell",
    );
    if (selected.length < 2) return;
    // React Flow's nodes carry measured sizes; getNodesBounds gives the true
    // selection rect so the shell wraps the content exactly.
    const bounds = getNodesBounds(selected);
    groupNodes(
      selected.map((n) => n.id),
      bounds,
    );
  }

  // Keyboard: Space = temporary pan · ⌘Z/⌘⇧Z = undo/redo · Delete = remove
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === " " && !e.repeat) {
        // Don't capture space when typing in a field
        const target = e.target as HTMLElement | null;
        const inField =
          !!target?.isContentEditable ||
          target?.tagName === "INPUT" ||
          target?.tagName === "TEXTAREA";
        if (inField) return;
        e.preventDefault();
        setSpaceHeld(true);
        return;
      }

      const target = e.target as HTMLElement | null;
      const inField =
        !!target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA";

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        if (inField) return;
        e.preventDefault();
        const temporal = useCanvasStore.temporal.getState();
        if (e.shiftKey) temporal.redo();
        else temporal.undo();
        return;
      }

      if ((e.key === "Backspace" || e.key === "Delete") && !inField) {
        const state = useCanvasStore.getState();
        const selectedNodeIds = state.nodes
          .filter((n) => n.selected)
          .map((n) => n.id);
        const selectedEdgeIds = state.edges
          .filter((edge) => edge.selected)
          .map((edge) => edge.id);
        if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) return;
        e.preventDefault();
        for (const id of selectedNodeIds) state.removeNode(id);
        for (const id of selectedEdgeIds) state.removeEdge(id);
        return;
      }

      // Tool shortcuts: V = select, H = hand (pan). Ignored while typing.
      if (!inField && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key.toLowerCase() === "v") setTool("select");
        else if (e.key.toLowerCase() === "h") setTool("hand");
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === " ") {
        setSpaceHeld(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Ctrl/Cmd + scroll = zoom (overrides panOnScroll)
  React.useEffect(() => {
    function handleWheel(e: WheelEvent) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) zoomIn({ duration: 120 });
        else zoomOut({ duration: 120 });
      }
    }
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [zoomIn, zoomOut]);

  // Smart paste: Cmd+V on the canvas (no field focused, no surface open)
  React.useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA"
      ) {
        return;
      }
      const state = useCanvasStore.getState();
      if (state.openSurfaceNodeId || state.readerPaper) return;

      const center = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      const jitter = state.nodes.length * 16;
      const at = { x: center.x - 100 + jitter, y: center.y - 30 + jitter };

      // A screenshot or copied image -> Figure node.
      const image = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (image) {
        e.preventDefault();
        addFigureFromFile(image, { x: at.x + 144, y: at.y + 40 }, "paste");
        return;
      }

      const text = e.clipboardData?.getData("text")?.trim();
      if (!text) return;
      e.preventDefault();
      // Cells copied from a spreadsheet (or CSV) -> Chart node.
      const table = looksTabular(text) ? parseTable(text) : null;
      if (table?.ok) {
        addNode("chart", at, { card: chartFromTable(table.table, suggestChart(table.table)) });
        return;
      }
      addNode("text", at, { text });
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [screenToFlowPosition, addNode]);

  const handleConnectStart: OnConnectStart = React.useCallback(
    (_event, params) => {
      dragOrigin.current = params.nodeId ?? null;
    },
    [],
  );

  const handleConnectEnd: OnConnectEnd = React.useCallback(
    (event, connectionState) => {
      if (connectionState.isValid || !dragOrigin.current) return;

      const { clientX, clientY } =
        "changedTouches" in event ? event.changedTouches[0] : event;

      const fromKind = nodes.find((n) => n.id === dragOrigin.current)?.data
        .kind as NodeKind | undefined;
      if (!fromKind) return;

      setSpawn({
        screen: { x: clientX, y: clientY },
        flow: screenToFlowPosition({ x: clientX, y: clientY }),
        fromNodeId: dragOrigin.current,
        options: SUGGESTED_NEXT[fromKind],
      });
    },
    [nodes, screenToFlowPosition],
  );

  function handleSpawnPick(kind: NodeKind) {
    if (!spawn) return;
    const newId = addNode(kind, {
      x: spawn.flow.x,
      y: spawn.flow.y - 60,
    });
    onConnect({
      source: spawn.fromNodeId,
      sourceHandle: "out",
      target: newId,
      targetHandle: "in",
    });
    spendCredits(getModel(DEFAULT_MODEL_ID).creditsPerRun);
    setSpawn(null);
  }

  function handlePaneContextMenu(
    event: React.MouseEvent | MouseEvent,
  ) {
    event.preventDefault();
    setSpawn(null);
    setPaneMenu({
      screen: { x: event.clientX, y: event.clientY },
      flow: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
    });
  }

  function handlePaneMenuPick(kind: NodeKind) {
    if (!paneMenu) return;
    addNode(kind, { x: paneMenu.flow.x - 144, y: paneMenu.flow.y - 40 });
    setPaneMenu(null);
  }

  // Transient menus close when the viewport moves
  const closeMenus = React.useCallback(() => {
    setSpawn(null);
    setPaneMenu(null);
  }, []);

  function handleTidy() {
    useCanvasStore.getState().tidyLayout();
    // Let React Flow apply the new positions, then frame the whole board.
    setTimeout(() => {
      void fitView({ duration: FOCUS_DURATION_MS, padding: TIDY_FIT_PADDING, maxZoom: 1 });
    }, ADD_REVEAL_DELAY_MS);
  }

  function handleToolbarAdd(kind: NodeKind) {
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    const jitter = nodes.length * 24;
    const id = addNode(kind, { x: center.x - 144 + jitter, y: center.y - 80 + jitter });
    // addNode nudges the node to a free spot, which can be off-screen when a
    // wide node fills the view — then the click looks like it did nothing.
    // Select it, and bring it into view if it isn't visible.
    setTimeout(() => {
      setNodes((all) => all.map((n) => ({ ...n, selected: n.id === id })));
      const el = document.querySelector(`.react-flow__node[data-id="${id}"]`);
      const pane = el?.closest(".react-flow")?.getBoundingClientRect();
      const box = el?.getBoundingClientRect();
      if (!pane || !box) return;
      const visible =
        box.left >= pane.left && box.right <= pane.right &&
        box.top >= pane.top && box.bottom <= pane.bottom;
      const node = getNode(id);
      if (visible || !node) return;
      const w = node.measured?.width ?? 0;
      const h = node.measured?.height ?? 0;
      void setCenter(node.position.x + w / 2, node.position.y + h / 2, {
        zoom: getZoom(),
        duration: FOCUS_DURATION_MS,
      });
    }, ADD_REVEAL_DELAY_MS);
  }

  // Drop a node onto a Shell to group it; drag it back out to ungroup. Uses
  // the dragged node's CENTER against shell bounds, and the store's
  // reparentNode owns the relative/absolute math + parent ordering.
  const handleNodeDragStop: import("@xyflow/react").OnNodeDrag = React.useCallback(
    (event, draggedNode) => {
      const state = useCanvasStore.getState();
      if ((draggedNode.data as Record<string, unknown>).kind === "shell") return;

      const parent = draggedNode.parentId
        ? state.nodes.find((n) => n.id === draggedNode.parentId)
        : undefined;
      const abs = parent
        ? {
            x: draggedNode.position.x + parent.position.x,
            y: draggedNode.position.y + parent.position.y,
          }
        : draggedNode.position;
      const center = {
        x: abs.x + (draggedNode.measured?.width ?? 288) / 2,
        y: abs.y + (draggedNode.measured?.height ?? 180) / 2,
      };

      // An insight dropped onto a theme becomes that theme's evidence. Aim
      // is the pointer (a tall card's centre can sit below a short theme).
      if ((draggedNode.data as Record<string, unknown>).kind === "insight") {
        const at = "changedTouches" in event ? event.changedTouches[0] : event;
        const pointer = at ? screenToFlowPosition({ x: at.clientX, y: at.clientY }) : center;
        const over = (n: (typeof state.nodes)[number], p: { x: number; y: number }) => {
          const w = n.measured?.width ?? 288;
          const h = n.measured?.height ?? 160;
          return p.x >= n.position.x && p.x <= n.position.x + w && p.y >= n.position.y && p.y <= n.position.y + h;
        };
        const theme = state.nodes.find((n) => n.data.kind === "theme" && !n.parentId && (over(n, pointer) || over(n, center)));
        if (theme) {
          state.connectMany([{ source: draggedNode.id, target: theme.id }]);
          return;
        }
      }

      const target = state.nodes.find((n) => {
        if (n.data.kind !== "shell" || n.id === draggedNode.id) return false;
        const w = n.measured?.width ?? (n.style?.width as number) ?? 480;
        const h = n.measured?.height ?? (n.style?.height as number) ?? 320;
        return (
          center.x >= n.position.x &&
          center.x <= n.position.x + w &&
          center.y >= n.position.y &&
          center.y <= n.position.y + h
        );
      });

      if (target) {
        if (draggedNode.parentId !== target.id) reparentNode(draggedNode.id, target.id);
      } else if (draggedNode.parentId) {
        // Dragged out of its shell and not over any other → ungroup.
        reparentNode(draggedNode.id, null);
      }
    },
    [reparentNode, screenToFlowPosition],
  );

  // Drag a found source out of the Sources node → drop it as a Paper node.
  const handleDragOver = React.useCallback((event: React.DragEvent) => {
    const dt = event.dataTransfer;
    const hasImageFile = Array.from(dt.items ?? []).some(
      (it) => it.kind === "file" && it.type.startsWith("image/"),
    );
    const hasUrl =
      dt.types.includes("text/uri-list") || dt.types.includes("text/plain");
    if (dt.types.includes(PAPER_DND_MIME) || hasImageFile || hasUrl) {
      event.preventDefault();
      dt.dropEffect = "copy";
    }
  }, []);

  // PDF upload (drop or toolbar): upload, add a Paper node, open it to read.
  const [uploadNote, setUploadNote] = React.useState<{ text: string; error: boolean } | null>(null);
  const pdfInputRef = React.useRef<HTMLInputElement>(null);

  const handlePdfFile = React.useCallback(
    async (file: File, at?: { x: number; y: number }) => {
      setUploadNote({ text: `Uploading ${file.name}…`, error: false });
      try {
        const paper = await uploadPdf(file);
        const pos =
          at ?? screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        const newId = addNode("paper", { x: pos.x - 144, y: pos.y - 40 }, { paper, label: paper.title });
        setNodeSources(newId, [paper]);
        // One library: a PDF uploaded on the canvas is saved to the project's Library too.
        const projectId = useCanvasStore.getState().projectId;
        if (projectId) useWorkspaceStore.getState().pinSource(projectId, paper);
        useCanvasStore.getState().notePopOut(newId, paper.title);
        useCanvasStore.getState().openReader(paper);
        setUploadNote(null);
      } catch (err: unknown) {
        setUploadNote({
          text: err instanceof PdfUploadError ? err.message : "Couldn't add that PDF. Try again.",
          error: true,
        });
        window.setTimeout(() => setUploadNote(null), UPLOAD_ERROR_MS);
      }
    },
    [addNode, screenToFlowPosition, setNodeSources],
  );

  const handleDrop = React.useCallback(
    (event: React.DragEvent) => {
      // 1) A source dragged out of the Sources node → Paper node.
      const raw = event.dataTransfer.getData(PAPER_DND_MIME);
      if (raw) {
        event.preventDefault();
        let paper: PaperSource;
        try {
          paper = JSON.parse(raw) as PaperSource;
        } catch {
          return;
        }
        const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        const newId = addNode(
          "paper",
          { x: pos.x - 144, y: pos.y - 40 },
          { paper, label: paper.title },
        );
        setNodeSources(newId, [paper]);
        return;
      }

      // 2) A PDF dropped from the OS → uploaded Paper node, opened to read.
      const pdf = Array.from(event.dataTransfer.files ?? []).find(isPdfFile);
      if (pdf) {
        event.preventDefault();
        void handlePdfFile(pdf, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
        return;
      }

      // 3) An image file dropped from the OS → Figure node.
      const file = Array.from(event.dataTransfer.files ?? []).find((f) =>
        f.type.startsWith("image/"),
      );
      if (!file) {
        // 3) A URL dragged from a browser (address bar, link, tab) → Link node.
        const dropped = (
          event.dataTransfer.getData("text/uri-list") ||
          event.dataTransfer.getData("text/plain")
        )
          .split("\n")
          .map((l) => l.trim())
          .find((l) => /^https?:\/\//i.test(l));
        if (dropped) {
          event.preventDefault();
          const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
          addNode("link", { x: pos.x - 144, y: pos.y - 40 }, { url: dropped });
        }
        return;
      }
      event.preventDefault();
      addFigureFromFile(file, screenToFlowPosition({ x: event.clientX, y: event.clientY }), "upload");
    },
    [screenToFlowPosition, addNode, setNodeSources],
  );

  // Suppress browser context menu on the canvas pane — never on fields
  function handleContextMenu(e: React.MouseEvent) {
    const target = e.target as HTMLElement | null;
    const inField =
      !!target?.isContentEditable ||
      target?.tagName === "INPUT" ||
      target?.tagName === "TEXTAREA";
    if (!inField) e.preventDefault();
  }

  return (
    <div
      className="size-full rf-cursor-fix"
      onContextMenu={handleContextMenu}
    >
      {/* Shared edge gradient — connectors fade between node-type accents,
          giving the canvas its luminous, flow-of-work read. */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <linearGradient id="lattice-edge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--color-node-explorer)" />
            <stop offset="0.5" stopColor="var(--color-node-processor)" />
            <stop offset="1" stopColor="var(--color-node-writing)" />
          </linearGradient>
        </defs>
      </svg>
      <Toolbar
        onAdd={handleToolbarAdd}
        tool={tool}
        onToolChange={setTool}
        onTidy={handleTidy}
        onUploadPdf={() => pdfInputRef.current?.click()}
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handlePdfFile(file);
        }}
      />
      {uploadNote && (
        <div
          role={uploadNote.error ? "alert" : "status"}
          className={cn(
            "animate-float-in absolute bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-xl border px-3 py-2 text-xs shadow-lift",
            uploadNote.error
              ? "border-feedback-danger-border bg-feedback-danger-bg text-feedback-danger"
              : "border-grey-200 bg-paper text-grey-700",
          )}
        >
          {uploadNote.text}
        </div>
      )}
      <OutlineSidebar />
      {selectedCount >= 2 && (
        <div className="absolute left-1/2 top-4 z-30 -translate-x-1/2 animate-float-in">
          <div className="flex items-center gap-1 rounded-xl border border-grey-200 bg-paper px-3 py-1.5 shadow-lift">
            <span className="text-[11px] font-medium text-grey-600">
              {selectedCount} selected
            </span>
            <div className="mx-1 h-4 w-px bg-grey-200" />
            <button
              onClick={handleWrapSelection}
              title="Put the selected nodes in a named section you can move and focus together"
              className="flex items-center gap-1 rounded-lg bg-ink px-2.5 py-1 text-[11px] font-medium text-paper transition-colors hover:bg-grey-800"
            >
              <Container className="size-3" />
              Group into section
            </button>
          </div>
        </div>
      )}
      <ReactFlow
        className={`size-full ${isPanning ? "canvas-grab" : ""}`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        nodes={flowNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        onPaneContextMenu={handlePaneContextMenu}
        onMoveStart={closeMenus}
        onNodeDragStop={handleNodeDragStop}
        onNodeDoubleClick={(_event, node) => {
          if (node.data.kind === "shell") {
            const store = useCanvasStore.getState();
            store.focusOnShell(node.id);
          }
        }}
        defaultEdgeOptions={{ type: "action" }}
        proOptions={{ hideAttribution: true }}
        // Hand tool / Space / middle-click = pan. Otherwise = box-select.
        panOnDrag={isPanning ? true : [1]}
        selectionOnDrag={!isPanning}
        // Scroll = vertical pan (like Miro). Ctrl+scroll = zoom (custom handler).
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        // Full: a node joins the box selection only when fully enclosed, so
        // grazing a neighbour's edge doesn't silently add it to the count.
        selectionMode={SelectionMode.Full}
        snapToGrid
        snapGrid={[16, 16]}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
        minZoom={0.15}
        maxZoom={3}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="var(--color-grey-200)"
        />
        <Controls position="bottom-right" showInteractive={false} />
      </ReactFlow>

      {spawn && (
        <ConnectionMenu
          request={spawn}
          onPick={handleSpawnPick}
          onClose={() => setSpawn(null)}
        />
      )}

      {paneMenu && (
        <NodeMenu
          title="Add a node"
          screen={paneMenu.screen}
          options={NODE_ORDER}
          onPick={handlePaneMenuPick}
          onClose={() => setPaneMenu(null)}
        />
      )}
      <FocusOverlay />
      <DeleteUndoBanner />
      <PopOutBanner />
    </div>
  );
}

export function ResearchCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}

const UNDO_BANNER_MS = 6000;
/** Let a newly added node mount and measure before checking visibility. */
const ADD_REVEAL_DELAY_MS = 120;
const UPLOAD_ERROR_MS = 5000;
const TIDY_FIT_PADDING = 0.12;
const POP_OUT_BANNER_MS = UNDO_BANNER_MS;
const FOCUS_ZOOM = 1;
const FOCUS_DURATION_MS = 400;

/**
 * Confirms a "Pop out" — the new Paper node usually lands off-screen, so this
 * says where it went and offers to jump there (without yanking the viewport
 * away while the user is still triaging sources).
 */
function PopOutBanner() {
  const lastPopOut = useCanvasStore((s) => s.lastPopOut);
  const { getNode, setCenter, setNodes } = useReactFlow();
  const [visible, setVisible] = React.useState(false);
  const ts = lastPopOut?.ts ?? 0;

  React.useEffect(() => {
    if (!ts) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), POP_OUT_BANNER_MS);
    return () => clearTimeout(t);
  }, [ts]);

  if (!visible || !lastPopOut) return null;

  function showNode() {
    if (!lastPopOut) return;
    const node = getNode(lastPopOut.nodeId);
    setVisible(false);
    if (!node) return;
    const w = node.measured?.width ?? 0;
    const h = node.measured?.height ?? 0;
    setCenter(node.position.x + w / 2, node.position.y + h / 2, {
      zoom: FOCUS_ZOOM,
      duration: FOCUS_DURATION_MS,
    });
    setNodes((all) => all.map((n) => ({ ...n, selected: n.id === node.id })));
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-float-in pointer-events-auto absolute bottom-6 left-1/2 z-40 -translate-x-1/2"
    >
      <div className="flex max-w-[min(90vw,420px)] items-center gap-2 rounded-xl border border-grey-200 bg-paper px-3 py-2 shadow-lift">
        <span className="min-w-0 truncate text-[12px] text-grey-600">
          Added to canvas: {lastPopOut.title}
        </span>
        <button
          type="button"
          onClick={showNode}
          className="flex shrink-0 items-center gap-1 rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-paper transition-colors hover:bg-grey-800"
        >
          Show
        </button>
      </div>
    </div>
  );
}

/**
 * L10 — a non-blocking "Deleted — Undo" banner that appears after any node or
 * edge removal. Deletions are always recoverable via temporal undo (⌘Z); this
 * surfaces that affordance so an accidental delete isn't a dead-end. The banner
 * auto-dismisses after `UNDO_BANNER_MS`; a fresh delete re-arms it.
 */
function DeleteUndoBanner() {
  const lastDeletion = useCanvasStore((s) => s.lastDeletion);
  const [visible, setVisible] = React.useState(false);
  const ts = lastDeletion?.ts ?? 0;

  React.useEffect(() => {
    if (!ts) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), UNDO_BANNER_MS);
    return () => clearTimeout(t);
  }, [ts]);

  // The banner only shows after a deletion and auto-hides; it's not focusable
  // content, so we keep it minimal and let the Undo button own the action.
  if (!visible || !ts) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-float-in pointer-events-auto absolute bottom-6 left-1/2 z-40 -translate-x-1/2"
    >
      <div className="flex items-center gap-2 rounded-xl border border-grey-200 bg-paper px-3 py-2 shadow-lift">
        <span className="text-[12px] text-grey-600">Item deleted</span>
        <button
          type="button"
          onClick={() => {
            useCanvasStore.temporal.getState().undo();
            setVisible(false);
          }}
          className="flex items-center gap-1 rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-paper transition-colors hover:bg-grey-800"
        >
          <Undo className="size-3" />
          Undo
        </button>
      </div>
    </div>
  );
}