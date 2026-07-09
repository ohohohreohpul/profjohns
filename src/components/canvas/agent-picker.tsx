"use client";

import * as React from "react";
import { Robot as Bot, CaretDown, Check } from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useCanvasStore } from "@/store/canvas-store";
import { useAgentStore, defaultAgentIdFor } from "@/store/agent-store";
import { type Agent, type AgentArchetype } from "@/lib/agents";
import { cn } from "@/lib/utils";

/**
 * The agent a node runs FROM. Reads/writes `data.agentId` on the node,
 * defaulting to the node's archetype built-in. Any AI node drops this in and
 * feeds the resolved agent's persona + model into its calls.
 */
export function useNodeAgent(
  nodeId: string,
  archetype: AgentArchetype,
): Agent | undefined {
  const agents = useAgentStore((s) => s.agents);
  React.useEffect(() => {
    void useAgentStore.persist.rehydrate();
  }, []);
  const nodes = useCanvasStore((s) => s.nodes);
  const selectedId =
    (nodes.find((n) => n.id === nodeId)?.data.agentId as string | undefined) ??
    defaultAgentIdFor(archetype);
  return (
    agents.find((a) => a.id === selectedId) ??
    agents.find((a) => a.id === defaultAgentIdFor(archetype)) ??
    agents[0]
  );
}

export function AgentPicker({
  nodeId,
  archetype,
  showLabel = true,
}: {
  nodeId: string;
  archetype: AgentArchetype;
  showLabel?: boolean;
}) {
  const agents = useAgentStore((s) => s.agents);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const agent = useNodeAgent(nodeId, archetype);

  return (
    <div className="nodrag flex items-center gap-1.5">
      {showLabel && (
        <span className="text-[10.5px] font-medium uppercase tracking-wider text-grey-400">
          Agent
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            data-testid="node-agent-trigger"
            className="flex items-center gap-1.5 rounded-md border border-grey-200 bg-paper px-2 py-1 text-[11.5px] font-medium text-ink outline-none transition-colors hover:border-grey-300"
          >
            <Bot className="size-3.5 text-grey-400" />
            {agent?.name ?? "Agent"}
            <CaretDown className="size-3 text-grey-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[280px] overflow-y-auto">
          {agents.map((a) => (
            <DropdownMenuItem
              key={a.id}
              data-testid={`node-agent-option-${a.id}`}
              onSelect={() => updateNodeData(nodeId, { agentId: a.id })}
            >
              <Check
                className={cn(
                  "size-3.5",
                  a.id === agent?.id ? "text-ink" : "text-transparent",
                )}
              />
              <span className="flex-1">{a.name}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
