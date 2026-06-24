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
  type OnConnectStart,
  type OnConnectEnd,
} from "@xyflow/react";
import { useCanvasStore } from "@/store/canvas-store";
import { SUGGESTED_NEXT, NODE_ORDER, type NodeKind } from "@/lib/node-catalog";
import { DEFAULT_MODEL_ID, getModel } from "@/lib/models";
import { cn } from "@/lib/utils";
import { Package as Container } from "@phosphor-icons/react";
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
import { processImageFile } from "@/lib/image";
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
};

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
  } = useCanvasStore();

  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();
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

  // "Wrap with Shell" — shown when multiple nodes are selected
  function handleWrapSelection() {
    const state = useCanvasStore.getState();
    const selected = state.nodes.filter((n) => n.selected && n.data.kind !== "shell");
    if (selected.length < 2) return;

    // Find bounding box of selected nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of selected) {
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + (n.measured?.width ?? 288));
      maxY = Math.max(maxY, n.position.y + (n.measured?.height ?? 180));
    }

    // Create shell encompassing them
    const shellId = addNode("shell", {
      x: minX - 24,
      y: minY - 48,
    });

    // Wait for the next tick so the shell node exists in React Flow
    requestAnimationFrame(() => {
      const s2 = useCanvasStore.getState();
      // Reparent selected nodes under the shell
      const updated = s2.nodes.map((n) => {
        if (selected.find((s) => s.id === n.id)) {
          return {
            ...n,
            parentId: shellId,
            position: {
              x: n.position.x - minX + 24,
              y: n.position.y - minY + 48,
            },
            selected: false,
          };
        }
        return n;
      });
      // Resize shell to fit children
      const shellW = maxX - minX + 48;
      const shellH = maxY - minY + 72;
      const shellUpdated = updated.map((n) =>
        n.id === shellId
          ? {
              ...n,
              style: { width: Math.max(320, shellW), height: Math.max(200, shellH) },
              selected: true,
            }
          : n,
      );
      useCanvasStore.setState({ nodes: shellUpdated });
    });
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

      const text = e.clipboardData?.getData("text")?.trim();
      if (!text) return;
      e.preventDefault();

      const center = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      const jitter = state.nodes.length * 16;
      addNode("text", {
        x: center.x - 100 + jitter,
        y: center.y - 30 + jitter,
      }, { text });
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

  function handleToolbarAdd(kind: NodeKind) {
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    const jitter = nodes.length * 24;
    addNode(kind, { x: center.x - 144 + jitter, y: center.y - 80 + jitter });
  }

  // Drag-to-stack: when a node is dropped, check if it landed on a Stack node
  const handleNodeDragStop: import("@xyflow/react").OnNodeDrag = React.useCallback(
    (
      _event,
      draggedNode,
    ) => {
      const state = useCanvasStore.getState();
      const d = draggedNode.data as Record<string, unknown>;
      if (d.kind === "shell") return;

      const dBox = {
        x: draggedNode.position.x,
        y: draggedNode.position.y,
        w: (draggedNode.measured?.width ?? 288),
        h: (draggedNode.measured?.height ?? 180),
      };

      // Check Shell nesting — drop node into shell
      const shells = state.nodes.filter((n) => n.data.kind === "shell");
      for (const shell of shells) {
        const sW = shell.measured?.width ?? 480;
        const sH = shell.measured?.height ?? 320;
        if (
          dBox.x < shell.position.x + sW &&
          dBox.x + dBox.w > shell.position.x &&
          dBox.y < shell.position.y + sH &&
          dBox.y + dBox.h > shell.position.y
        ) {
          const relX = draggedNode.position.x - shell.position.x;
          const relY = Math.max(48, draggedNode.position.y - shell.position.y);
          const updatedNodes = state.nodes.map((n) =>
            n.id === draggedNode.id
              ? { ...n, parentId: shell.id, position: { x: relX, y: relY } }
              : n,
          );
          useCanvasStore.setState({ nodes: updatedNodes });
          return;
        }
      }
    },
    [],
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

      // 2) An image file dropped from the OS → Media node.
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
      const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const newId = addNode("media", { x: pos.x - 144, y: pos.y - 40 });
      processImageFile(file)
        .then((img) =>
          useCanvasStore.getState().updateNodeData(newId, {
            media: {
              src: img.src,
              width: img.width,
              height: img.height,
              name: img.name,
              credit: "Uploaded",
            },
          }),
        )
        .catch(() => {
          // leave the node in its empty dropzone state on failure
        });
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
      <Toolbar onAdd={handleToolbarAdd} tool={tool} onToolChange={setTool} />
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
              className="flex items-center gap-1 rounded-lg bg-ink px-2.5 py-1 text-[11px] font-medium text-paper transition-colors hover:bg-grey-800"
            >
              <Container className="size-3" />
              Wrap with Shell
            </button>
          </div>
        </div>
      )}
      <ReactFlow
        className={`size-full ${isPanning ? "canvas-grab" : ""}`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        nodes={nodes}
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
        selectionMode={SelectionMode.Partial}
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