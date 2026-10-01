import { test, expect } from "@playwright/test";
import { decideKeeps, KEEP_THRESHOLD, FALLBACK_FLOOR } from "../src/lib/keep-policy";

/**
 * Regression: on production (Jev scoring) a narrow PhD question scored its
 * best of 12 results at 43-53, all below the 70 keep bar, so 0 were kept and
 * the Draft/editor downstream had nothing to cite. Found by the Jev
 * PhD-student journey simulation run against the live site.
 */
test.describe("decideKeeps", () => {
  test("keeps only strong matches when any exist", () => {
    const r = decideKeeps([KEEP_THRESHOLD + 5, 60, 40, undefined]);
    expect(r).toEqual({ kept: [true, false, false, false], isFallback: false });
  });

  test("falls back to the closest few when nothing clears the bar", () => {
    // The real production distribution: best 53, then 45, 44, 40, 36, 25...
    const r = decideKeeps([25, 53, 36, 22, 40, 44, 45]);
    expect(r.isFallback).toBe(true);
    expect(r.kept).toEqual([false, true, false, false, false, true, true]);
  });

  test("never falls back to papers below the floor", () => {
    const r = decideKeeps([FALLBACK_FLOOR - 1, 10, undefined]);
    expect(r).toEqual({ kept: [false, false, false], isFallback: false });
  });

  test("ignores unscored papers in the fallback", () => {
    const r = decideKeeps([undefined, 50]);
    expect(r).toEqual({ kept: [false, true], isFallback: true });
  });
});
