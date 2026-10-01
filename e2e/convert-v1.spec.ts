import { test, expect } from "@playwright/test";
import { convertV1Board } from "../src/lib/board/convert-v1";
import { parseCardData } from "../src/lib/board/schema";

/**
 * One-time conversion of a v1 canvas board (React Flow nodes + side maps)
 * into v2 walls of cards (docs/REBUILD.md §10 migration). The old board is
 * left untouched; conversion only reads it.
 */
const paper = (id: string, title: string) => ({ id, title, authors: "A. Author", venue: "V", year: 2021, abstract: "" });

const v1 = {
  direction: "Do bandits beat A/B tests?",
  nodes: [
    { id: "n1", data: { kind: "explorer", topic: "bandits" } },
    { id: "n2", data: { kind: "writing" } },
    { id: "n3", data: { kind: "paper", paper: paper("W9", "Pinned paper") } },
    { id: "n4", data: { kind: "text", text: 'Finding: "Effects are tiny"\n— A. Author (2021), p. 3, Inferno' } },
    { id: "n5", data: { kind: "block", text: "Remember to email my advisor" } },
    { id: "n6", data: { kind: "processor", synthesis: { claims: [{ claim: "Bandits reduce regret", sources: [1], evidence: "" }], contradictions: [], themes: [] } } },
    { id: "n7", data: { kind: "shell", label: "Group" } },
  ],
  edges: [],
  sources: { n1: [paper("W1", "Kept one"), paper("W2", "Kept two")], n3: [paper("W9", "Pinned paper")] },
  docs: { n2: { title: "My chapter", content: { type: "doc", content: [] }, style: "apa", outline: ["Intro"] } },
};

test("maps every v1 node kind to the right wall and card", () => {
  const out = convertV1Board(v1);
  const by = (wall: string) => out.filter((c) => c.wall === wall);

  expect(by("question").map((c) => (c.data as { text: string }).text)).toEqual(["Do bandits beat A/B tests?"]);
  expect(by("sources").map((c) => (c.data as { paper: { title: string }; status: string }).paper.title)).toEqual(["Kept one", "Kept two"]);
  expect(by("sources").every((c) => (c.data as { status: string }).status === "kept")).toBe(true);
  expect(by("reading").map((c) => (c.data as { paper: { title: string } }).paper.title)).toEqual(["Pinned paper"]);

  const insights = by("insights").filter((c) => c.kind === "insight");
  const finding = insights.find((c) => (c.data as { type: string }).type === "finding")!.data as { quote: { text: string; page: number } };
  expect(finding.quote).toEqual({ text: "Effects are tiny", page: 3 });
  expect(insights.some((c) => (c.data as { statement: string }).statement === "Bandits reduce regret")).toBe(true);
  expect(by("insights").some((c) => c.kind === "note" && (c.data as { text: string }).text.includes("advisor"))).toBe(true);

  const draft = by("draft")[0];
  expect(draft.kind).toBe("draft");
  expect((draft.data as { title: string }).title).toBe("My chapter");
});

test("every converted payload is valid for its card kind", () => {
  for (const c of convertV1Board(v1)) expect(() => parseCardData(c.kind, c.data)).not.toThrow();
});

test("does not duplicate a paper that is both kept and pinned", () => {
  const out = convertV1Board({ ...v1, sources: { n1: [paper("W9", "Pinned paper")], n3: [paper("W9", "Pinned paper")] } });
  expect(out.filter((c) => c.kind === "paper")).toHaveLength(1);
});

test("an empty or malformed board converts to nothing", () => {
  expect(convertV1Board({})).toEqual([]);
  expect(convertV1Board({ nodes: "oops" })).toEqual([]);
  expect(convertV1Board(null)).toEqual([]);
});
