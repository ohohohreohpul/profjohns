"use client";

import { useCanvasStore } from "@/store/canvas-store";
import { WritingSurface } from "./writing-surface";

export function SurfaceOverlay() {
  const openId = useCanvasStore((s) => s.openSurfaceNodeId);
  const direction = useCanvasStore((s) => s.direction);
  const node = useCanvasStore((s) =>
    s.nodes.find((n) => n.id === s.openSurfaceNodeId),
  );
  const closeSurface = useCanvasStore((s) => s.closeSurface);

  if (!openId || !node) return null;

  if (node.data.kind === "writing") {
    return (
      <WritingSurface
        nodeId={node.id}
        direction={direction}
        modelId={node.data.modelId}
        onClose={closeSurface}
      />
    );
  }

  return null;
}