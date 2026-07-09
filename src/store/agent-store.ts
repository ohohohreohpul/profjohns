"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  type Agent,
  type AgentArchetype,
  BUILTIN_AGENTS,
  builtInId,
} from "@/lib/agents";

/**
 * Account-level agent library (VISION Phase 2). localStorage-persisted,
 * mirroring the workspace store's pattern (skipHydration + manual rehydrate).
 * DB sync is a follow-up (same shape as use-workspace-sync). Built-in
 * archetypes are seeded on first run; they can be edited and reset but not
 * deleted. Users can create/edit/delete custom agents.
 */

function now(): number {
  return Date.now();
}

function newAgentId(): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `agent-${uuid}`;
}

/** Built-ins seed at a FIXED epoch (not now()) so an UNEDITED default is
 *  always "older" than any real edit. This makes the merge deterministic
 *  cross-device: a built-in you edited on another device (real updatedAt)
 *  wins over the freshly-seeded default on a new device, instead of the
 *  just-stamped seed clobbering your edit. */
const BUILTIN_EPOCH = 0;
function seededBuiltins(): Agent[] {
  return BUILTIN_AGENTS.map((a) => ({
    ...a,
    createdAt: BUILTIN_EPOCH,
    updatedAt: BUILTIN_EPOCH,
  }));
}

export type NewAgentInput = {
  name: string;
  description: string;
  systemPrompt: string;
  modelId: string;
  archetype?: AgentArchetype;
  citationStyle?: string;
};

interface AgentState {
  agents: Agent[];
  hasHydrated: boolean;

  /** All built-in archetypes present? (used to backfill after upgrades). */
  ensureSeeded: () => void;
  addAgent: (input: NewAgentInput) => string;
  /** Duplicate any agent (built-in or custom) into a new editable custom one. */
  cloneAgent: (id: string) => string | null;
  updateAgent: (id: string, patch: Partial<Omit<Agent, "id" | "builtIn" | "createdAt">>) => void;
  removeAgent: (id: string) => void;
  /** Restore a built-in to its shipped defaults. No-op for custom agents. */
  resetAgent: (id: string) => void;
  getAgent: (id: string) => Agent | undefined;
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      agents: [],
      hasHydrated: false,

      ensureSeeded: () =>
        set((s) => {
          const have = new Set(s.agents.map((a) => a.id));
          const missing = seededBuiltins().filter((b) => !have.has(b.id));
          return missing.length ? { agents: [...s.agents, ...missing] } : s;
        }),

      addAgent: (input) => {
        const id = newAgentId();
        const t = now();
        set((s) => ({
          agents: [
            ...s.agents,
            {
              id,
              name: input.name.trim() || "Untitled agent",
              archetype: input.archetype ?? "custom",
              description: input.description.trim(),
              systemPrompt: input.systemPrompt.trim(),
              modelId: input.modelId,
              builtIn: false,
              citationStyle: input.citationStyle,
              createdAt: t,
              updatedAt: t,
            },
          ],
        }));
        return id;
      },

      cloneAgent: (id) => {
        const src = get().agents.find((a) => a.id === id);
        if (!src) return null;
        const newId = newAgentId();
        const t = now();
        set((s) => ({
          agents: [
            ...s.agents,
            {
              ...src,
              id: newId,
              name: `${src.name} copy`,
              builtIn: false,
              createdAt: t,
              updatedAt: t,
            },
          ],
        }));
        return newId;
      },

      updateAgent: (id, patch) =>
        set((s) => ({
          agents: s.agents.map((a) =>
            a.id === id ? { ...a, ...patch, updatedAt: now() } : a,
          ),
        })),

      removeAgent: (id) =>
        set((s) => ({
          // Built-ins can't be deleted — only reset.
          agents: s.agents.filter((a) => a.id !== id || a.builtIn),
        })),

      resetAgent: (id) =>
        set((s) => {
          const def = BUILTIN_AGENTS.find((b) => b.id === id);
          if (!def) return s;
          const t = now();
          return {
            agents: s.agents.map((a) =>
              a.id === id ? { ...def, createdAt: a.createdAt, updatedAt: t } : a,
            ),
          };
        }),

      getAgent: (id) => get().agents.find((a) => a.id === id),
    }),
    {
      name: "lattice-agents",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ agents: s.agents }),
      onRehydrateStorage: () => (state) => {
        // Seed/backfill built-ins after hydration, then mark ready.
        if (state) {
          const have = new Set(state.agents.map((a) => a.id));
          const missing = seededBuiltins().filter((b) => !have.has(b.id));
          if (missing.length) state.agents = [...state.agents, ...missing];
        }
        useAgentStore.setState({ hasHydrated: true });
      },
    },
  ),
);

/** Convenience: the default agent for a given node archetype. */
export function defaultAgentIdFor(archetype: AgentArchetype): string {
  return builtInId(archetype);
}
