import { test, expect } from "@playwright/test";
import type { JSONContent } from "@tiptap/core";
import { appendFigure, figureCaption, figureNodeFor, listFigures, FIGURE_NODE } from "../src/lib/draft-figures";
import { docToMarkdown, docToPlainText, docToLatex } from "../src/lib/export";

const SOURCE = { paperId: "1204.5721", title: "Regret Analysis of Bandit Problems", authors: "Sebastien Bubeck, Nicolo Cesa-Bianchi", year: 2012 };
const FIGURE = { image: { path: "u/figures/a.png", width: 700, height: 737 }, caption: "Regret of UCB over time", source: SOURCE, page: 3, origin: "pdf-capture" as const };
const CHART = {
  title: "ImageNet accuracy",
  type: "bar" as const,
  columns: ["Model", "Top-1"],
  rows: [["ViT-B", 81.8], ["MLP-Mixer", 76.4]],
  xColumn: 0,
  yColumns: [1],
  caption: "",
};

const doc = (...blocks: JSONContent[]): JSONContent => ({ type: "doc", content: blocks });
const para = (text: string): JSONContent => ({ type: "paragraph", content: [{ type: "text", text }] });

test("a board card becomes a self-contained figure node", () => {
  const node = figureNodeFor({ id: "card-1", kind: "figure", data: FIGURE });
  expect(node.type).toBe(FIGURE_NODE);
  expect(node.attrs).toEqual({ cardId: "card-1", kind: "figure", data: FIGURE });
});

test("figures are numbered in document order, charts and images together", () => {
  const content = doc(
    para("Intro"),
    figureNodeFor({ id: "c", kind: "chart", data: CHART }),
    para("Middle"),
    figureNodeFor({ id: "f", kind: "figure", data: FIGURE }),
  );
  expect(listFigures(content).map((f) => [f.number, f.cardId])).toEqual([
    [1, "c"],
    [2, "f"],
  ]);
});

test("captions read like a paper: number, title, caption, source", () => {
  expect(figureCaption("figure", FIGURE, 2)).toBe("Figure 2. Regret of UCB over time. Source: Sebastien Bubeck et al. (2012), p. 3.");
  expect(figureCaption("chart", CHART, 1)).toBe("Figure 1. ImageNet accuracy.");
  expect(figureCaption("figure", { ...FIGURE, caption: "", source: undefined }, 4)).toBe("Figure 4.");
});

test("appendFigure returns a new doc and leaves the original untouched", () => {
  const original = doc(para("Hello"));
  const next = appendFigure(original, figureNodeFor({ id: "f", kind: "figure", data: FIGURE }));
  expect(original.content).toHaveLength(1);
  expect(next.content?.map((n) => n.type)).toEqual(["paragraph", FIGURE_NODE, "paragraph"]);
  // An empty draft (one empty paragraph) is replaced, not left as a blank line;
  // a paragraph always follows so writing can continue after the figure.
  const fromEmpty = appendFigure(doc({ type: "paragraph" }), figureNodeFor({ id: "f", kind: "figure", data: FIGURE }));
  expect(fromEmpty.content?.map((n) => n.type)).toEqual([FIGURE_NODE, "paragraph"]);
});

test("exports carry numbered figure captions", () => {
  const wd = {
    title: "Bandits",
    style: "apa" as const,
    outline: [],
    content: doc(para("We compare."), figureNodeFor({ id: "c", kind: "chart", data: CHART }), figureNodeFor({ id: "f", kind: "figure", data: FIGURE })),
  };
  const md = docToMarkdown(wd as never);
  expect(md).toContain("**Figure 1.** ImageNet accuracy.");
  expect(md).toContain("**Figure 2.** Regret of UCB over time. Source: Sebastien Bubeck et al. (2012), p. 3.");
  expect(docToPlainText(wd as never)).toContain("Figure 1. ImageNet accuracy.");
  expect(docToLatex(wd as never)).toContain("\\paragraph*{Figure 2.} Regret of UCB over time.");
});
