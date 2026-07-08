"use client";

import * as React from "react";
import {
  Robot as Bot,
  PaperPlaneTilt as Send,
  CircleNotch as Loader2,
  Sparkle as Sparkles,
  Plus,
  CaretDown,
  Check,
} from "@phosphor-icons/react";
import { NodeShell, type CanvasNodeProps } from "./node-shell";
import { useCanvasStore } from "@/store/canvas-store";
import { useAgentStore, defaultAgentIdFor } from "@/store/agent-store";
import { agentSystemPrompt } from "@/lib/agents";
import { editText } from "@/lib/ai-client";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant" | "error";
  text: string;
  actions?: { label: string; node: string; content: string }[];
}

const SUGGESTIONS = [
  "Summarize everything on my canvas",
  "What should I do next?",
  "Help me structure my research",
  "Draft an introduction from my sources",
];

export function AssistantNode({ id, data, selected }: CanvasNodeProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const addNode = useCanvasStore((s) => s.addNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [thread, setThread] = React.useState<Message[]>([]);
  const [, setError] = React.useState<string | null>(null);

  // The agent this node runs from — its persona + model drive the replies.
  const agents = useAgentStore((s) => s.agents);
  React.useEffect(() => {
    void useAgentStore.persist.rehydrate();
  }, []);
  const agentId = (data.agentId as string) ?? defaultAgentIdFor("assistant");
  const agent =
    agents.find((a) => a.id === agentId) ??
    agents.find((a) => a.id === defaultAgentIdFor("assistant")) ??
    agents[0];

  function canvasSummary(): string {
    const kinds = nodes.map((n) => {
      const d = n.data as Record<string, unknown>;
      const label = d.label ?? d.text?.toString().slice(0, 60) ?? "";
      return `${d.kind}${label ? `: "${label}"` : ""}`;
    });
    return `Canvas has ${nodes.length} nodes: ${kinds.join(", ")}.`;
  }

  async function send(prompt?: string) {
    const q = (prompt ?? input).trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    setError(null);

    setThread((t) => [...t, { role: "user", text: q }]);

    try {
      const ctx = canvasSummary();
      // The bound agent's system prompt (persona) leads the call; the
      // instruction below just frames the task + canvas context.
      const persona = agent ? agentSystemPrompt(agent) : undefined;
      const answer = await editText(
        ctx,
        `The user asks: "${q}". ${ctx} Respond conversationally. If the user asks you to create something, suggest specific nodes they could add. Keep it concise and actionable.`,
        persona,
      );

      // Look for actionable suggestions in the response
      const actions = parseActions(answer);

      setThread((t) => [
        ...t,
        { role: "assistant", text: cleanResponse(answer), actions },
      ]);
    } catch (err: unknown) {
      setThread((t) => [
        ...t,
        {
          role: "error",
          text: err instanceof Error ? err.message : "Something went wrong.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function parseActions(text: string): Message["actions"] {
    const actions: Message["actions"] = [];
    // Detect phrases like "create a Note node with..."
    const createMatch = text.match(
      /create (?:a |an )?(note|block|shell|text|writing)\b[^.]*[""](.+?)[""]/i,
    );
    if (createMatch) {
      actions.push({
        label: `Create ${createMatch[1]}`,
        node: createMatch[1].toLowerCase(),
        content: createMatch[2],
      });
    }
    return actions;
  }

  function cleanResponse(text: string): string {
    return text
      .replace(/create (?:a |an )?(note|block|shell|text|writing)\b[^.]*[""]/gi, "")
      .trim();
  }

  function handleAction(action: NonNullable<Message["actions"]>[number]) {
    const validKinds = ["text", "block", "shell", "writing"];
    const kind = validKinds.includes(action.node) ? action.node : "text";
    const self = nodes.find((n) => n.id === id);
    const base = self?.position ?? { x: 0, y: 0 };
    addNode(
      kind as "text" | "block" | "shell" | "writing",
      { x: base.x + 360, y: base.y + nodes.length * 24 },
      kind === "text"
        ? { text: action.content }
        : kind === "shell"
          ? { label: action.content }
          : {},
    );
  }

  return (
    <NodeShell
      id={id}
      kind="assistant"
      selected={selected}
      modelId={data.modelId}
      hideModel
      className="w-[420px]"
    >
      {/* Agent selector — which agent this node runs from. */}
      <div className="nodrag mb-2.5 flex items-center gap-1.5">
        <span className="text-[10.5px] font-medium uppercase tracking-wider text-grey-400">
          Agent
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              data-testid="assistant-agent-trigger"
              className="flex items-center gap-1.5 rounded-md border border-grey-200 bg-paper px-2 py-1 text-[11.5px] font-medium text-ink outline-none transition-colors hover:border-grey-300"
            >
              <Bot className="size-3.5 text-grey-400" />
              {agent?.name ?? "Assistant"}
              <CaretDown className="size-3 text-grey-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-[280px] overflow-y-auto">
            {agents.map((a) => (
              <DropdownMenuItem
                key={a.id}
                data-testid={`assistant-agent-option-${a.id}`}
                onSelect={() => updateNodeData(id, { agentId: a.id })}
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

      {/* Suggestions — shown before first message */}
      {thread.length === 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={busy}
              className="nodrag flex items-center gap-1 rounded-full border border-grey-200 px-2.5 py-1 text-[10px] font-medium text-grey-600 transition-colors hover:border-grey-300 hover:bg-grey-50 hover:text-ink disabled:opacity-40"
            >
              <Sparkles className="size-3 text-grey-400" />
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Chat thread */}
      <div className="max-h-[320px] space-y-2.5 overflow-y-auto">
        {thread.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "rounded-xl px-3 py-2 text-[12px] leading-relaxed",
              msg.role === "user"
                ? "ml-8 bg-ink text-paper animate-bubble-in-right"
                : msg.role === "error"
                  ? "border border-red-200 bg-red-50/50 text-red-600"
                  : "border border-grey-200 bg-grey-50/50 text-grey-700 animate-bubble-in-left",
            )}
          >
            {msg.role === "assistant" && (
              <Bot className="size-3.5 mb-1 text-grey-400" />
            )}
            <p className="whitespace-pre-wrap">{msg.text}</p>

            {/* Action buttons from assistant */}
            {msg.actions && msg.actions.length > 0 && (
              <div className="nodrag mt-2 flex flex-wrap gap-1">
                {msg.actions.map((a, j) => (
                  <button
                    key={j}
                    onClick={() => handleAction(a)}
                    className="flex items-center gap-1 rounded-lg border border-grey-300 bg-paper px-2 py-1 text-[10px] font-medium text-ink transition-colors hover:bg-ink hover:text-paper"
                  >
                    <Plus className="size-3" />
                    {a.label}: {a.content.slice(0, 40)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Busy state */}
      {busy && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-grey-200 bg-grey-50 px-3 py-2 text-[11px] text-grey-500">
          <Loader2 className="size-3.5 animate-spin" />
          Thinking…
        </div>
      )}

      {/* Input */}
      <div className="nodrag mt-2.5 flex items-center gap-1.5 rounded-xl border border-grey-200 bg-grey-50/80 px-2.5 py-1.5 transition-colors focus-within:border-grey-300 focus-within:bg-paper focus-within:ring-4 focus-within:ring-ink/5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask the assistant…"
          className="min-w-0 flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-grey-400"
        />
        <button
          onClick={() => send()}
          disabled={busy || !input.trim()}
          className="grid size-6 shrink-0 place-items-center rounded-lg bg-ink text-paper transition-colors hover:bg-grey-800 disabled:opacity-30"
        >
          <Send className="size-3" />
        </button>
      </div>
    </NodeShell>
  );
}