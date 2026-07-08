import { test, expect } from "@playwright/test";
import {
  BUILTIN_AGENTS,
  builtInId,
  agentSystemPrompt,
  type Agent,
} from "../src/lib/agents";

/** Pure unit tests for the Agent model (no store, no browser). */

test.describe("BUILTIN_AGENTS", () => {
  test("ships the five archetypes with unique, stable ids", () => {
    expect(BUILTIN_AGENTS).toHaveLength(5);
    const ids = BUILTIN_AGENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(5);
    for (const a of BUILTIN_AGENTS) {
      expect(a.id).toBe(builtInId(a.archetype));
      expect(a.builtIn).toBe(true);
      expect(a.systemPrompt.length).toBeGreaterThan(20);
      expect(a.name.trim()).not.toBe("");
    }
  });

  test("includes scout, synthesizer, stylist, citationist, assistant", () => {
    const archetypes = BUILTIN_AGENTS.map((a) => a.archetype).sort();
    expect(archetypes).toEqual([
      "assistant",
      "citationist",
      "scout",
      "stylist",
      "synthesizer",
    ]);
  });
});

test.describe("agentSystemPrompt", () => {
  const base = (over: Partial<Agent>): Agent => ({
    id: "x",
    name: "X",
    archetype: "custom",
    description: "",
    systemPrompt: "BASE PROMPT",
    modelId: "claude-sonnet-4-6",
    builtIn: false,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  });

  test("returns the prompt unchanged for non-citationist agents", () => {
    expect(agentSystemPrompt(base({}))).toBe("BASE PROMPT");
  });

  test("folds the citation style into a citationist's prompt", () => {
    const out = agentSystemPrompt(
      base({ archetype: "citationist", citationStyle: "MLA 9" }),
    );
    expect(out).toContain("BASE PROMPT");
    expect(out).toContain("MLA 9");
  });

  test("citationist without a style is left unchanged", () => {
    const out = agentSystemPrompt(base({ archetype: "citationist" }));
    expect(out).toBe("BASE PROMPT");
  });
});
