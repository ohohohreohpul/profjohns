import { test, expect } from "@playwright/test";
import { interleave, rankByScore } from "../src/lib/source-pool";

/**
 * Regression: only the first 12 results were ever screened, and they came
 * from the first one or two angles — later angles' papers (often the most
 * specific) were never scored. The pool now interleaves angles and is
 * pre-ranked by relevance before screening.
 */
test.describe("interleave", () => {
  test("takes one from each list in turn", () => {
    expect(interleave([["a1", "a2", "a3"], ["b1"], ["c1", "c2"]])).toEqual([
      "a1", "b1", "c1", "a2", "c2", "a3",
    ]);
  });

  test("handles empty input", () => {
    expect(interleave([[], []])).toEqual([]);
  });
});

test.describe("rankByScore", () => {
  test("orders by score, unscored last, stable for ties", () => {
    const r = rankByScore(["a", "b", "c", "d"], [40, null, 70, 40]);
    expect(r.map((x) => x.item)).toEqual(["c", "a", "d", "b"]);
    expect(r.map((x) => x.score)).toEqual([70, 40, 40, null]);
  });
});
