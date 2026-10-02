import { test, expect } from "@playwright/test";
import { canvasClaims, canvasVisuals, themeInsights, cardOf, themesFromSynthesis, insightsAsSources } from "../src/lib/canvas-cards";

const SOURCE = { paperId: "p1", title: "Bandits beat A/B tests", authors: "E. Schwartz", year: 2017 };
const insight = (id: string, statement: string) => ({
  id,
  data: { kind: "insight", card: { type: "finding", statement, quote: { text: statement, page: 3 }, source: SOURCE, origin: "highlight" } },
});
const theme = (id: string, name: string) => ({ id, data: { kind: "theme", card: { name } } });
const chart = { id: "c1", data: { kind: "chart", card: { title: "Accuracy", type: "bar", columns: ["m", "v"], rows: [["a", 1]], xColumn: 0, yColumns: [1], caption: "" } } };
const figure = { id: "f1", data: { kind: "figure", card: { image: { src: "data:image/png;base64,AA" }, caption: "UCB regret", origin: "paste" } } };
const draft = { id: "w1", data: { kind: "writing" } };
const edge = (source: string, target: string) => ({ id: `${source}-${target}`, source, target });

test("cardOf validates a node's card and rejects broken data", () => {
  expect(cardOf(insight("i1", "Bandits learn faster"), "insight")?.statement).toBe("Bandits learn faster");
  expect(cardOf({ id: "x", data: { kind: "insight", card: { statement: "" } } }, "insight")).toBeNull();
  expect(cardOf(theme("t1", "Speed"), "insight")).toBeNull();
});

test("a theme's insights are the insight nodes connected into it", () => {
  const nodes = [insight("i1", "A"), insight("i2", "B"), theme("t1", "Speed")];
  const edges = [edge("i1", "t1")];
  expect(themeInsights(nodes, edges, "t1").map((c) => c.id)).toEqual(["i1"]);
});

test("draft claims: insights grouped under the themes wired into the draft, plus loose insights", () => {
  const nodes = [insight("i1", "Bandits learn faster"), insight("i2", "Costs drop 40%"), insight("i3", "Unwired"), theme("t1", "Speed"), draft];
  const edges = [edge("i1", "t1"), edge("t1", "w1"), edge("i2", "w1")];
  const claims = canvasClaims(nodes, edges, "w1");
  expect(claims).toContain("Speed");
  expect(claims).toContain("Bandits learn faster");
  expect(claims).toContain("Costs drop 40%");
  expect(claims).not.toContain("Unwired");
  expect(canvasClaims(nodes, [], "w1")).toBe("");
});

test("visuals: every valid figure and chart on the canvas, by node id", () => {
  const v = canvasVisuals([figure, chart, draft, { id: "bad", data: { kind: "figure", card: {} } }]);
  expect(v.map((x) => [x.id, x.kind])).toEqual([
    ["f1", "figure"],
    ["c1", "chart"],
  ]);
});

test("suggested themes map the AI's 1-based source numbers back to insight nodes", () => {
  const groups = themesFromSynthesis(["i1", "i2", "i3"], [
    { theme: "Speed", sources: [1, 3, 3] },
    { theme: "Cost", sources: [2, 9] },
    { theme: "Empty", sources: [7] },
    { theme: "  ", sources: [1] },
  ]);
  expect(groups).toEqual([
    { name: "Speed", insightIds: ["i1", "i3"] },
    { name: "Cost", insightIds: ["i2"] },
  ]);
});

test("insights become numbered sources for the synthesis, citing their papers", () => {
  const nodes = [insight("i1", "Bandits learn faster"), theme("t1", "x"), insight("i2", "Costs drop")];
  const { ids, sources } = insightsAsSources(nodes);
  expect(ids).toEqual(["i1", "i2"]);
  expect(sources[0]).toMatchObject({ title: "Bandits beat A/B tests", authors: "E. Schwartz", year: 2017, abstract: "Bandits learn faster" });
});
