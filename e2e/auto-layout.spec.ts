import { test, expect } from "@playwright/test";
import { layoutLeftToRight, type LayoutNode } from "../src/lib/auto-layout";

/**
 * Tidy up: as a board grows, nodes land wherever there was free space and
 * connections cross and loop — the PhD-journey simulation read that as
 * "broken or empty". The layout puts each node one column right of
 * everything that feeds it, ordered to keep lines from crossing.
 */
const box = (id: string, w = 300, h = 200): LayoutNode => ({ id, width: w, height: h });

test.describe("layoutLeftToRight", () => {
  test("places each node one column right of what feeds it", () => {
    const pos = layoutLeftToRight(
      [box("draft"), box("synth"), box("sources")],
      [
        { source: "sources", target: "synth" },
        { source: "synth", target: "draft" },
        { source: "sources", target: "draft" },
      ],
    );
    expect(pos.sources.x).toBeLessThan(pos.synth.x);
    expect(pos.synth.x).toBeLessThan(pos.draft.x);
  });

  test("column width follows the widest node so nothing overlaps", () => {
    const pos = layoutLeftToRight(
      [box("wide", 840, 600), box("next", 300, 200)],
      [{ source: "wide", target: "next" }],
    );
    expect(pos.next.x).toBeGreaterThanOrEqual(pos.wide.x + 840);
  });

  test("stacks nodes in the same column without overlap", () => {
    const pos = layoutLeftToRight([box("a", 300, 200), box("b", 300, 150)], []);
    const [top, bottom] = [pos.a, pos.b].sort((p, q) => p.y - q.y);
    const topHeight = top === pos.a ? 200 : 150;
    expect(bottom.y).toBeGreaterThanOrEqual(top.y + topHeight);
  });

  test("orders a column by its inputs to avoid crossing lines", () => {
    // p1 sits above p2, so the node fed by p1 should sit above the one fed by p2.
    const pos = layoutLeftToRight(
      [box("p1"), box("p2"), box("fromP2"), box("fromP1")],
      [
        { source: "p1", target: "fromP1" },
        { source: "p2", target: "fromP2" },
      ],
      { p1: 0, p2: 1 },
    );
    expect(pos.fromP1.y).toBeLessThan(pos.fromP2.y);
  });

  test("survives a cycle without hanging", () => {
    const pos = layoutLeftToRight(
      [box("a"), box("b")],
      [
        { source: "a", target: "b" },
        { source: "b", target: "a" },
      ],
    );
    expect(Object.keys(pos).sort()).toEqual(["a", "b"]);
  });
});
