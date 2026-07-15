"use client";

import * as React from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import { X } from "@phosphor-icons/react";
import { useCanvasStore } from "@/store/canvas-store";
import { cn } from "@/lib/utils";

export function ActionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  selected,
}: EdgeProps) {
  const removeEdge = useCanvasStore((s) => s.removeEdge);
  const [hovered, setHovered] = React.useState(false);

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const active = hovered || selected;

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        className={cn(
          "transition-[stroke,stroke-width] duration-150",
          active && "!stroke-ink",
        )}
        style={active ? { strokeWidth: 2 } : undefined}
      />
      {/* Wide invisible path — generous hover/click target over the thin edge. */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <EdgeLabelRenderer>
        <button
          type="button"
          title="Remove connection"
          aria-label="Remove connection"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={(e) => {
            e.stopPropagation();
            removeEdge(id);
          }}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          className={cn(
            "nodrag nopan absolute grid size-5 place-items-center rounded-full border border-grey-200 bg-paper text-grey-500 shadow-[0_4px_12px_-4px_rgba(21,23,28,0.35)] transition-all duration-150 hover:border-red-200 hover:bg-red-50 hover:text-red-500",
            active
              ? "pointer-events-auto scale-100 opacity-100"
              : "pointer-events-none scale-75 opacity-0",
          )}
        >
          <X className="size-3" />
        </button>
      </EdgeLabelRenderer>
    </>
  );
}
