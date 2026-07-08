/**
 * The Agent abstraction (VISION Phase 2).
 *
 * An Agent is a reusable, configurable research persona — a name, a role, a
 * system prompt, a default model, and archetype-specific config. Nodes run
 * FROM an agent (the node picks which agent it uses); the same agent is later
 * usable headless for background tasks.
 *
 * Built-in archetypes ship with the product (editable + resettable). Users
 * can also create custom agents. This module is pure data + types (no JSX),
 * so it's safe to import anywhere (stores, API, components, tests).
 */

export type AgentArchetype =
  | "scout"
  | "synthesizer"
  | "stylist"
  | "citationist"
  | "assistant"
  | "custom";

export interface Agent {
  id: string;
  name: string;
  archetype: AgentArchetype;
  /** One-line role shown on the card. */
  description: string;
  /** The persona/behavior prompt injected into the agent's AI calls. */
  systemPrompt: string;
  /** Default model id (from lib/models). */
  modelId: string;
  /** True for the shipped archetypes — can be edited/reset but not deleted. */
  builtIn: boolean;
  /** Citationist only — the citation convention to enforce. */
  citationStyle?: string;
  createdAt: number;
  updatedAt: number;
}

/** Visual identity per archetype (icon key + accent CSS var). The surface maps
 *  the `icon` key to a lucide/phosphor component — kept out of this data module
 *  so it stays JSX-free. */
export const ARCHETYPE_META: Record<
  Exclude<AgentArchetype, "custom"> | "custom",
  { icon: string; accent: string }
> = {
  scout: { icon: "telescope", accent: "var(--color-node-explorer)" },
  synthesizer: { icon: "sparkles", accent: "var(--color-node-processor)" },
  stylist: { icon: "pen", accent: "var(--color-node-writing)" },
  citationist: { icon: "quote", accent: "var(--color-node-reader)" },
  assistant: { icon: "bot", accent: "var(--color-node-assistant)" },
  custom: { icon: "bot", accent: "var(--color-grey-500)" },
};

const CITATION_STYLE_DEFAULT = "APA 7th edition";

/** Stable ids so node→agent bindings survive re-seeding. */
export const builtInId = (archetype: AgentArchetype): string => `builtin-${archetype}`;

/** The shipped agents. `createdAt/updatedAt` are stamped at seed time by the
 *  store (this module must stay free of Date.now for testability). */
export const BUILTIN_AGENTS: ReadonlyArray<Omit<Agent, "createdAt" | "updatedAt">> = [
  {
    id: builtInId("scout"),
    name: "Scout",
    archetype: "scout",
    description:
      "Finds relevant work — and deliberately seeks counter-sources and disconfirming evidence so you see both sides.",
    systemPrompt:
      "You are Scout, a research discovery agent. Find the most relevant scholarly work for the user's topic, and DELIBERATELY surface counter-sources and disconfirming evidence so the user sees every side. Prefer primary sources and reputable venues. Be rigorous about relevance and flag weak matches honestly. Never fabricate papers or findings.",
    modelId: "claude-sonnet-4-6",
    builtIn: true,
  },
  {
    id: builtInId("synthesizer"),
    name: "Synthesizer",
    archetype: "synthesizer",
    description:
      "Reasons over your kept sources into structured claims, evidence, and contradictions — every point traced to a citation.",
    systemPrompt:
      "You are Synthesizer. Reason over the user's kept sources into structured claims. For every claim, cite the specific source(s) that support it, surface contradictions between sources, and never assert anything not grounded in the provided sources. Distinguish strong from weak evidence.",
    modelId: "claude-opus-4-8",
    builtIn: true,
  },
  {
    id: builtInId("stylist"),
    name: "Stylist",
    archetype: "stylist",
    description:
      "Writes in your dialect. Learns from your past papers to argue the way you argue and sound like you.",
    systemPrompt:
      "You are Stylist, the user's personal writing agent. Draft in the user's own dialect and argument style — mirror their phrasing patterns, structure, and hedging level. Write clear academic prose grounded in the provided sources. Never fabricate citations.",
    modelId: "claude-sonnet-4-6",
    builtIn: true,
  },
  {
    id: builtInId("citationist"),
    name: "Citationist",
    archetype: "citationist",
    description:
      "Enforces your citation convention and verifies every reference actually exists — no fabricated citations.",
    systemPrompt:
      "You are Citationist. Enforce the user's citation convention and verify that every reference is real and correctly attributed. Flag any claim that lacks a citation and any citation you cannot confirm. Never invent references.",
    modelId: "claude-sonnet-4-6",
    builtIn: true,
    citationStyle: CITATION_STYLE_DEFAULT,
  },
  {
    id: builtInId("assistant"),
    name: "Research Assistant",
    archetype: "assistant",
    description:
      "A general canvas companion — summarizes, plans next steps, and helps structure your research.",
    systemPrompt:
      "You are the ProfJohns research assistant. Help the user think on their canvas — summarize what's there, propose next steps, and help structure their research. Be concise, concrete, and actionable. When useful, suggest specific nodes to add.",
    modelId: "claude-sonnet-4-6",
    builtIn: true,
  },
];

/** The effective system prompt for an agent, folding in archetype config
 *  (e.g. the Citationist's chosen citation style). */
export function agentSystemPrompt(agent: Agent): string {
  if (agent.archetype === "citationist" && agent.citationStyle?.trim()) {
    return `${agent.systemPrompt}\n\nCitation convention to enforce: ${agent.citationStyle.trim()}.`;
  }
  return agent.systemPrompt;
}
