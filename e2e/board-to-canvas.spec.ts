import { test, expect } from "@playwright/test";
import { boardToCanvas } from "../src/lib/board/to-canvas";
import { remapCardIds, FIGURE_NODE, FIGURE_MENTION_NODE } from "../src/lib/draft-figures";
import type { BoardSnapshot, Card } from "../src/lib/board/schema";

const paper = (id: string, title: string) => ({ id, title, authors: "A. Author", venue: "V", year: 2020, abstract: "x" });
let n = 0;
const card = (kind: Card["kind"], wallId: string, data: unknown, id = `c${++n}`): Card =>
  ({ id, boardId: "b", wallId, kind, position: n, data, updatedAt: "" }) as Card;

const walls = ["question", "sources", "reading", "insights", "themes", "draft"].map((kind, i) => ({
  id: `w-${kind}`, boardId: "b", kind, title: kind, position: i, collapsed: false,
})) as BoardSnapshot["walls"];

const HL = { id: "h1", text: "a passage", paraIndex: -1, page: 2 };
const snapshot: BoardSnapshot = {
  walls,
  links: [],
  cards: [
    card("question", "w-question", { text: "Do bandits beat A/B tests?" }, "q"),
    card("paper", "w-sources", { paper: paper("p-kept", "Kept paper"), status: "kept", highlights: [HL] }, "pk"),
    card("paper", "w-sources", { paper: paper("p-new", "Unreviewed result"), status: "new", highlights: [] }, "pn"),
    card("paper", "w-reading", { paper: paper("p-cited", "Cited but new"), status: "new", highlights: [] }, "pc"),
    card("insight", "w-insights", { type: "finding", statement: "Bandits learn faster", quote: { text: "Bandits learn faster", page: 2 }, source: { paperId: "p-kept", title: "Kept paper" }, themeId: "t", origin: "highlight" }, "i1"),
    card("insight", "w-insights", { type: "method", statement: "Uses Thompson sampling", source: { paperId: "p-cited", title: "Cited but new" }, origin: "manual" }, "i2"),
    card("theme", "w-themes", { name: "Speed" }, "t"),
    card("note", "w-insights", { text: "check effect sizes" }, "nt"),
    card("figure", "w-insights", { image: { src: "data:image/png;base64,AA" }, caption: "UCB", origin: "paste" }, "fg"),
    card("draft", "w-draft", { title: "My paper", content: { type: "doc", content: [{ type: FIGURE_NODE, attrs: { cardId: "fg", kind: "figure", data: {} } }] }, style: "apa", outline: ["Speed"] }, "d"),
  ],
};

test("every card becomes a canvas node; unreviewed papers that nothing cites stay behind", () => {
  const out = boardToCanvas(snapshot, { x: 0, y: 0 });
  const kinds = out.nodes.map((x) => `${x.key}:${x.kind}`);
  expect(kinds).toEqual(["q:text", "pk:paper", "pc:paper", "i1:insight", "i2:insight", "nt:text", "fg:figure", "t:theme", "d:writing"]);
  expect(out.skippedPapers).toBe(1);
  expect(out.direction).toBe("Do bandits beat A/B tests?");
});

test("relations become wires: paper -> its insights, insight -> its theme, themes and papers -> the draft", () => {
  const out = boardToCanvas(snapshot, { x: 0, y: 0 });
  expect(out.links).toEqual(
    expect.arrayContaining([
      { from: "pk", to: "i1" },
      { from: "pc", to: "i2" },
      { from: "i1", to: "t" },
      { from: "t", to: "d" },
      { from: "pk", to: "d" },
      { from: "pc", to: "d" },
    ]),
  );
  // Membership lives on the wire now, not on the insight.
  const i1 = out.nodes.find((x) => x.key === "i1")!;
  expect((i1.data.card as { themeId?: string }).themeId).toBeUndefined();
  expect((i1.data.paper as { id: string }).id).toBe("p-kept");
});

test("highlights and the draft document come along; nodes are laid out in columns by stage", () => {
  const out = boardToCanvas(snapshot, { x: 100, y: 50 });
  expect(out.highlights).toEqual({ "p-kept": [HL] });
  expect(out.docs.d).toMatchObject({ title: "My paper", style: "apa", outline: ["Speed"] });
  const x = (key: string) => out.nodes.find((n2) => n2.key === key)!.position.x;
  expect(x("q")).toBe(100);
  expect(x("pk")).toBeGreaterThan(x("q"));
  expect(x("i1")).toBeGreaterThan(x("pk"));
  expect(x("t")).toBeGreaterThan(x("i1"));
  expect(x("d")).toBeGreaterThan(x("t"));
});

test("remapCardIds points a draft's figures and references at the new node ids", () => {
  const content = {
    type: "doc",
    content: [
      { type: FIGURE_NODE, attrs: { cardId: "fg", kind: "figure", data: {} } },
      { type: "paragraph", content: [{ type: FIGURE_MENTION_NODE, attrs: { cardId: "fg" } }, { type: FIGURE_MENTION_NODE, attrs: { cardId: "gone" } }] },
    ],
  };
  const out = remapCardIds(content, new Map([["fg", "n7"]]));
  expect(out.content?.[0].attrs?.cardId).toBe("n7");
  expect(out.content?.[1].content?.[0].attrs?.cardId).toBe("n7");
  expect(out.content?.[1].content?.[1].attrs?.cardId).toBe("gone");
  expect(content.content[0].attrs?.cardId).toBe("fg"); // original untouched
});

test("a board converted FROM this canvas doesn't come back as duplicates; links reuse what's already there", () => {
  const draftContent = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }] };
  const migrated: BoardSnapshot = {
    walls,
    links: [],
    cards: [
      card("question", "w-question", { text: "Do bandits beat A/B tests?" }, "q2"),
      card("paper", "w-reading", { paper: paper("p-on-canvas", "Already a node"), status: "kept", highlights: [] }, "pa"),
      card("insight", "w-insights", { type: "claim", statement: "From an old note", origin: "migrated" }, "im"),
      card("insight", "w-insights", { type: "finding", statement: "Made on the board", source: { paperId: "p-on-canvas", title: "Already a node" }, origin: "highlight" }, "ib"),
      card("note", "w-insights", { text: "same note text" }, "nn"),
      card("draft", "w-draft", { title: "T", content: draftContent, style: "apa", outline: [] }, "dd"),
    ],
  };
  const out = boardToCanvas(migrated, { x: 0, y: 0 }, {
    paperIds: new Set(["p-on-canvas"]),
    texts: new Set(["same note text"]),
    docContents: new Set([JSON.stringify(draftContent)]),
    direction: "Do bandits beat A/B tests?",
  });
  expect(out.nodes.map((x) => x.key)).toEqual(["ib"]);
  expect(out.reused).toEqual({ pa: { paper: "p-on-canvas" }, dd: { doc: JSON.stringify(draftContent) } });
  expect(out.links).toEqual(expect.arrayContaining([{ from: "pa", to: "ib" }]));
});
