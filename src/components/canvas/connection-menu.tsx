"use client";

import { type NodeKind } from "@/lib/node-catalog";
import { NodeMenu } from "./node-menu";

export interface SpawnRequest {
  /** Screen coordinates where the connection was dropped. */
  screen: { x: number; y: number };
  /** Flow coordinates to place the new node. */
  flow: { x: number; y: number };
  /** The node the connection was dragged from. */
  fromNodeId: string;
  /** Candidate node kinds to offer. */
  options: NodeKind[];
}

export function ConnectionMenu({
  request,
  onPick,
  onClose,
}: {
  request: SpawnRequest;
  onPick: (kind: NodeKind) => void;
  onClose: () => void;
}) {
  return (
    <NodeMenu
      title="Connect to a new node"
      screen={request.screen}
      options={request.options}
      onPick={onPick}
      onClose={onClose}
    />
  );
}
