"use client";

import * as React from "react";
import {
  Binoculars as Telescope,
  Sparkle as Sparkles,
  PencilSimpleLine as PenLine,
  Quotes as Quote,
  Robot as Bot,
  Plus,
  Trash as Trash2,
  ArrowCounterClockwise as Reset,
  X,
} from "@phosphor-icons/react";
import { SurfaceScaffold } from "../workspace-shell";
import { useAgentStore } from "@/store/agent-store";
import { ARCHETYPE_META, type Agent } from "@/lib/agents";
import { MODELS, getModel } from "@/lib/models";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof Telescope> = {
  telescope: Telescope,
  sparkles: Sparkles,
  pen: PenLine,
  quote: Quote,
  bot: Bot,
};

function iconFor(agent: Agent): typeof Telescope {
  return ICONS[ARCHETYPE_META[agent.archetype].icon] ?? Bot;
}

export function AgentsSurface() {
  const hasHydrated = useAgentStore((s) => s.hasHydrated);
  const agents = useAgentStore((s) => s.agents);
  const addAgent = useAgentStore((s) => s.addAgent);

  const [editingId, setEditingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    void useAgentStore.persist.rehydrate();
  }, []);

  const sorted = React.useMemo(
    () => [...agents].sort((a, b) => Number(b.builtIn) - Number(a.builtIn)),
    [agents],
  );

  function handleNew() {
    const id = addAgent({
      name: "New agent",
      description: "",
      systemPrompt:
        "You are a research agent. Describe how this agent should behave here.",
      modelId: "claude-sonnet-4-6",
      archetype: "custom",
    });
    setEditingId(id);
  }

  return (
    <SurfaceScaffold
      title="Agents"
      description="Your personal research agents — configure them here, use them across the canvas"
      action={
        <button
          onClick={handleNew}
          data-testid="agent-new"
          className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-medium text-paper transition-colors hover:bg-grey-800"
        >
          <Plus className="size-4" />
          New agent
        </button>
      }
    >
      {!hasHydrated ? (
        <p className="text-[13px] text-grey-400">Loading agents…</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {sorted.map((agent) => {
            const Icon = iconFor(agent);
            const accent = ARCHETYPE_META[agent.archetype].accent;
            return (
              <div
                key={agent.id}
                data-testid={`agent-card-${agent.id}`}
                className="flex flex-col rounded-xl border border-grey-200 bg-paper p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span
                    className="grid size-9 place-items-center rounded-lg"
                    style={{
                      color: accent,
                      backgroundColor: `color-mix(in oklch, ${accent} 12%, white)`,
                    }}
                  >
                    <Icon className="size-[18px]" />
                  </span>
                  <span className="rounded-full bg-grey-100 px-2 py-0.5 text-[10px] font-medium text-grey-500">
                    {agent.builtIn ? "Built-in" : "Custom"}
                  </span>
                </div>
                <p className="mt-3 font-display text-[14px] font-semibold tracking-tight text-ink">
                  {agent.name}
                </p>
                <p className="mt-1 line-clamp-3 flex-1 text-[12px] leading-relaxed text-grey-500">
                  {agent.description || "No description."}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-mono text-[10.5px] text-grey-400">
                    {getModel(agent.modelId).label}
                  </span>
                  <button
                    onClick={() => setEditingId(agent.id)}
                    data-testid={`agent-configure-${agent.id}`}
                    className="rounded-md border border-grey-200 px-2.5 py-1 text-[11px] font-medium text-grey-700 transition-colors hover:border-grey-400 hover:text-ink"
                  >
                    Configure
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingId && (
        <AgentEditor agentId={editingId} onClose={() => setEditingId(null)} />
      )}
    </SurfaceScaffold>
  );
}

function AgentEditor({
  agentId,
  onClose,
}: {
  agentId: string;
  onClose: () => void;
}) {
  const agent = useAgentStore((s) => s.agents.find((a) => a.id === agentId));
  const updateAgent = useAgentStore((s) => s.updateAgent);
  const removeAgent = useAgentStore((s) => s.removeAgent);
  const resetAgent = useAgentStore((s) => s.resetAgent);

  // Local draft so typing doesn't thrash the store; commit on Save.
  const [draft, setDraft] = React.useState<Agent | undefined>(agent);
  React.useEffect(() => setDraft(agent), [agent]);

  if (!draft) return null;
  const current = draft;

  function set<K extends keyof Agent>(key: K, value: Agent[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  function handleSave() {
    updateAgent(agentId, {
      name: current.name,
      description: current.description,
      systemPrompt: current.systemPrompt,
      modelId: current.modelId,
      citationStyle: current.citationStyle,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Configure ${current.name}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[86vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-grey-200 bg-paper shadow-lift"
      >
        <header className="flex items-center justify-between border-b border-grey-200 px-5 py-3.5">
          <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink">
            Configure agent
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid size-7 place-items-center rounded-md text-grey-400 transition-colors hover:bg-grey-100 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <Field label="Name">
            <input
              data-testid="agent-editor-name"
              value={current.name}
              onChange={(e) => set("name", e.target.value)}
              className="w-full rounded-lg border border-grey-200 bg-paper px-3 py-2 text-[13.5px] text-ink outline-none transition-colors focus:border-grey-400"
            />
          </Field>

          <Field label="Description">
            <input
              value={current.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="One line — what this agent is for"
              className="w-full rounded-lg border border-grey-200 bg-paper px-3 py-2 text-[13.5px] text-ink outline-none transition-colors focus:border-grey-400"
            />
          </Field>

          <Field label="Model">
            <select
              data-testid="agent-editor-model"
              value={current.modelId}
              onChange={(e) => set("modelId", e.target.value)}
              className="w-full rounded-lg border border-grey-200 bg-paper px-3 py-2 text-[13.5px] text-ink outline-none transition-colors focus:border-grey-400"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} · {m.tier}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="System prompt"
            hint="How this agent behaves — its persona and rules."
          >
            <textarea
              data-testid="agent-editor-prompt"
              value={current.systemPrompt}
              onChange={(e) => set("systemPrompt", e.target.value)}
              rows={7}
              className="w-full resize-y rounded-lg border border-grey-200 bg-paper px-3 py-2 text-[12.5px] leading-relaxed text-ink outline-none transition-colors focus:border-grey-400"
            />
          </Field>

          {current.archetype === "citationist" && (
            <Field label="Citation style">
              <input
                value={current.citationStyle ?? ""}
                onChange={(e) => set("citationStyle", e.target.value)}
                placeholder="e.g. APA 7th edition"
                className="w-full rounded-lg border border-grey-200 bg-paper px-3 py-2 text-[13.5px] text-ink outline-none transition-colors focus:border-grey-400"
              />
            </Field>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-grey-200 px-5 py-3">
          <div>
            {current.builtIn ? (
              <button
                onClick={() => {
                  resetAgent(agentId);
                  onClose();
                }}
                data-testid="agent-editor-reset"
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-grey-500 transition-colors hover:bg-grey-100 hover:text-ink"
              >
                <Reset className="size-3.5" />
                Reset to default
              </button>
            ) : (
              <button
                onClick={() => {
                  removeAgent(agentId);
                  onClose();
                }}
                data-testid="agent-editor-delete"
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-grey-500 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="size-3.5" />
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-grey-200 px-3.5 py-2 text-[13px] font-medium text-grey-700 transition-colors hover:bg-grey-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              data-testid="agent-editor-save"
              className="rounded-md bg-ink px-3.5 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-grey-800"
            >
              Save
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mb-4")}>
      <label className="mb-1.5 block text-[12px] font-medium text-grey-600">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-grey-400">{hint}</p>}
    </div>
  );
}
