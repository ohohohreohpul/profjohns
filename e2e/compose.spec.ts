import { test, expect } from "@playwright/test";
import { parseSectionParagraph, sectionToContent } from "../src/lib/compose";
import type { PaperSource } from "../src/lib/mock";

/** Pure unit tests for Compose — [n] markers → real citation marks. */

const paper = (id: string, authors: string, year: number): PaperSource =>
  ({ id, title: id, authors, year } as PaperSource);

const PAPERS = [
  paper("p1", "Schiemann et al.", 2024),
  paper("p2", "Conan & DeBeliso", 2020),
];

test.describe("parseSectionParagraph", () => {
  test("converts [n] into a cited piece with APA display text", () => {
    const pieces = parseSectionParagraph(
      "Strength predicts speed [1].",
      PAPERS,
      "apa",
      [],
    );
    expect(pieces).toHaveLength(3);
    expect(pieces[0]).toEqual({ text: "Strength predicts speed " });
    expect(pieces[1].paperId).toBe("p1");
    expect(pieces[1].text).toBe("(Schiemann et al., 2024)");
    expect(pieces[2]).toEqual({ text: "." });
  });

  test("numeric styles use stable first-appearance indices incl. prior cites", () => {
    const citedOrder = ["p9"]; // something already cited in the doc
    const pieces = parseSectionParagraph(
      "A [2] then B [1].",
      PAPERS,
      "ieee",
      citedOrder,
    );
    const cites = pieces.filter((p) => p.paperId);
    expect(cites[0]).toMatchObject({ paperId: "p2", text: "[2]" }); // p9=1, p2=2
    expect(cites[1]).toMatchObject({ paperId: "p1", text: "[3]" });
  });

  test("an out-of-range marker is left as visible plain text (never laundered)", () => {
    const pieces = parseSectionParagraph("Bold claim [7].", PAPERS, "apa", []);
    expect(pieces).toHaveLength(1);
    expect(pieces[0].text).toBe("Bold claim [7].");
    expect(pieces[0].paperId).toBeUndefined();
  });

  test("repeat citation of the same paper reuses its index", () => {
    const order: string[] = [];
    parseSectionParagraph("First [1].", PAPERS, "ieee", order);
    const again = parseSectionParagraph("Again [1].", PAPERS, "ieee", order);
    expect(order).toEqual(["p1"]);
    expect(again.find((p) => p.paperId)?.text).toBe("[1]");
  });
});

test.describe("sectionToContent", () => {
  test("emits an H2 + paragraphs with citation marks", () => {
    const nodes = sectionToContent(
      "Methods",
      "We measured strength [1].\n\nThen speed [2].",
      PAPERS,
      "apa",
    );
    expect(nodes[0]).toMatchObject({ type: "heading", attrs: { level: 2 } });
    expect(nodes).toHaveLength(3);
    const cited = nodes[1].content?.find(
      (c) => Array.isArray(c.marks) && c.marks.length > 0,
    );
    expect(cited?.marks?.[0]).toEqual({
      type: "citation",
      attrs: { paperId: "p1" },
    });
  });

  test("does not mutate the caller's citedSoFar", () => {
    const cited = ["p2"];
    sectionToContent("S", "X [1].", PAPERS, "ieee", cited);
    expect(cited).toEqual(["p2"]);
  });

  test("empty title → no heading; blank prose → no paragraphs", () => {
    expect(sectionToContent("", "", PAPERS, "apa")).toEqual([]);
  });
});
