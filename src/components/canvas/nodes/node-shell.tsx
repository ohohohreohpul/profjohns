"use client";

import * as React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ArrowsOutSimple as Maximize2, Copy, Trash as Trash2, Play, LinkBreak as Unlink, DotsSixVertical } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { NODE_DEFINITIONS, type NodeKind } from "@/lib/node-catalog";
import { ModelPicker } from "@/components/canvas/model-picker";
import { useCanvasStore } from "@/store/canvas-store";

interface NodeShellProps {
  id: string;
  kind: NodeKind;
  selected?: boolean;
  modelId: string;
  hideTarget?: boolean;
  hideSource?: boolean;
  /** Small count/status chip shown next to the label above the card. */
  badge?: React.ReactNode;
  /** Opens the node's full surface (Reader/Draft/etc). */
  onOpen?: () => void;
  /** Primary action — when set, a Run button appears in the action rail. */
  onRun?: () => void;
  /** Node-specific controls rendered inside the floating toolbar (e.g. text formatting). */
  toolbar?: React.ReactNode;
  hideModel?: boolean;
  children: React.ReactNode;
  className?: string;
}

/** Floating action-rail button (left of the active card). */
function RailButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "nodrag grid size-[34px] place-items-center rounded-[11px] border border-grey-200 bg-paper/95 text-grey-500 shadow-[0_6px_16px_-8px_rgba(21,23,28,0.3)] backdrop-blur transition-all hover:-translate-x-0.5",
        danger
          ? "hover:border-red-200 hover:bg-red-50 hover:text-red-500"
          : "hover:border-grey-300 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

export function NodeShell({
  id,
  kind,
  selected,
  modelId,
  hideTarget,
  hideSource,
  badge,
  onOpen,
  onRun,
  toolbar,
  hideModel,
  children,
  className,
}: NodeShellProps) {
  const def = NODE_DEFINITIONS[kind];
  const Icon = def.icon;
  const setNodeModel = useCanvasStore((s) => s.setNodeModel);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const duplicateNode = useCanvasStore((s) => s.duplicateNode);
  const disconnectNode = useCanvasStore((s) => s.disconnectNode);
  const isConnected = useCanvasStore((s) =>
    s.edges.some((e) => e.source === id || e.target === id),
  );

  const showToolbar = selected && (!!toolbar || !hideModel);

  return (
    <div
      className={cn("group/node relative", className)}
      // --accent drives the accent icon, selection ring, and handles.
      style={{ "--accent": def.accent } as React.CSSProperties}
    >
      {/* Label — sits above the card, quiet identity, and is the node's ONLY
          drag handle. The card body is `nodrag`, so the node never moves when
          you grab its surface or empty padding — only this title strip. */}
      <div className="node-drag-handle mb-2 flex cursor-grab items-center gap-1.5 px-1 active:cursor-grabbing">
        <span className="text-grey-300 transition-colors group-hover/node:text-grey-400">
          <DotsSixVertical className="size-[13px]" weight="bold" />
        </span>
        <span style={{ color: def.accent }}>
          <Icon className="size-[14px]" />
        </span>
        <span className="truncate text-[12.5px] font-medium tracking-tight text-grey-600">
          {def.label}
        </span>
        {badge}
      </div>

      {/* Floating contextual toolbar — above the whole node, active only. */}
      {showToolbar && (
        <div className="nodrag absolute bottom-full left-0 z-20 mb-1.5 flex animate-float-in items-center gap-1 rounded-[13px] border border-grey-200 bg-paper/95 p-1.5 shadow-[0_12px_30px_-12px_rgba(21,23,28,0.32)] backdrop-blur-md">
          {toolbar}
          {toolbar && !hideModel && (
            <span className="mx-0.5 h-5 w-px bg-grey-200" />
          )}
          {!hideModel && (
            <ModelPicker
              modelId={modelId}
              onChange={(value) => setNodeModel(id, value)}
            />
          )}
        </div>
      )}

      {/* The card — one clean surface. */}
      <div
        className={cn(
          "node-surface animate-node-in relative w-full min-w-[240px] rounded-2xl border border-grey-200 transition-shadow duration-200",
          selected && "is-selected",
        )}
      >
        {!hideTarget && (
          <Handle
            type="target"
            position={Position.Left}
            id="in"
            className="!-left-[4px] !size-[8px] !border !border-grey-200 !bg-grey-100 transition-all duration-150 hover:!size-[12px] hover:!-left-[6px] hover:!border-ink hover:!bg-ink"
          />
        )}

        {/* Action rail — floats left of the card, active only. */}
        {selected && (
          <div className="nodrag absolute right-full top-3 z-20 mr-2 flex animate-float-in flex-col gap-1.5">
            {onOpen && (
              <RailButton label={`Open ${def.label}`} onClick={onOpen}>
                <Maximize2 className="size-4" />
              </RailButton>
            )}
            {onRun && (
              <RailButton label="Run" onClick={onRun}>
                <Play className="size-4" />
              </RailButton>
            )}
            <RailButton label="Duplicate" onClick={() => duplicateNode(id)}>
              <Copy className="size-4" />
            </RailButton>
            {isConnected && (
              <RailButton
                label="Disconnect all"
                onClick={() => disconnectNode(id)}
              >
                <Unlink className="size-4" />
              </RailButton>
            )}
            <RailButton label="Delete" onClick={() => removeNode(id)} danger>
              <Trash2 className="size-4" />
            </RailButton>
          </div>
        )}

        {/* Body — `nodrag` so the surface (and any empty space) never starts a
            node drag; the header strip above is the sole drag handle. */}
        <div className="nodrag p-4">{children}</div>

        {!hideSource && (
          <Handle
            type="source"
            position={Position.Right}
            id="out"
            className="!-right-[4px] !size-[8px] !border !border-grey-200 !bg-grey-100 transition-all duration-150 hover:!size-[12px] hover:!-right-[6px] hover:!border-ink hover:!bg-ink"
          />
        )}
      </div>
    </div>
  );
}

/** Narrows React Flow's generic NodeProps to our data shape. */
export type CanvasNodeProps = NodeProps & {
  data: {
    kind: NodeKind;
    label: string;
    modelId: string;
    [key: string]: unknown;
  };
};
