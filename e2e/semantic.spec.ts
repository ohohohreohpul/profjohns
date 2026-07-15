import { test, expect } from "@playwright/test";
import { cosineSimilarity } from "../src/lib/semantic";

/** Pure unit tests for the semantic-ranking math. */

test.describe("cosineSimilarity", () => {
  test("identical vectors → 1", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
  });

  test("orthogonal vectors → 0", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  test("opposite vectors → -1", () => {
    expect(cosineSimilarity([1, 1], [-1, -1])).toBeCloseTo(-1, 10);
  });

  test("scale-invariant (direction only)", () => {
    expect(cosineSimilarity([2, 0], [8, 0])).toBeCloseTo(1, 10);
  });

  test("degenerate input is safe (0, not NaN)", () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    expect(cosineSimilarity([1, 2, 3], [1, 2])).toBe(0);
  });
});
