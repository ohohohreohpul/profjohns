import { test, expect } from "@playwright/test";
import { newCandidates, isDue, titleKey, type StandingTask } from "../src/lib/watch";
import type { PaperSource } from "../src/lib/mock";

/** Pure unit tests for the Phase 4 standing-task helpers. */

const src = (id: string, title: string): PaperSource =>
  ({ id, title } as PaperSource);

const task = (over: Partial<StandingTask>): StandingTask => ({
  id: "t",
  topic: "cats",
  sources: [],
  schedule: "daily",
  enabled: true,
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

const DAY = 86_400_000;

test.describe("newCandidates", () => {
  test("drops candidates already known by id", () => {
    const out = newCandidates([src("a", "A"), src("b", "B")], ["a"]);
    expect(out.map((p) => p.id)).toEqual(["b"]);
  });

  test("drops cross-index duplicates by normalized title", () => {
    const out = newCandidates([src("x1", "Deep Learning!")], [], [titleKey("deep   learning")]);
    expect(out).toHaveLength(0);
  });

  test("dedups within the candidate batch itself", () => {
    const out = newCandidates([src("a", "Same Title"), src("b", "same title")], []);
    expect(out.map((p) => p.id)).toEqual(["a"]);
  });

  test("skips malformed rows (no id/title)", () => {
    const out = newCandidates([{ id: "", title: "" } as PaperSource, src("a", "A")], []);
    expect(out.map((p) => p.id)).toEqual(["a"]);
  });
});

test.describe("isDue", () => {
  test("manual tasks are never auto-due", () => {
    expect(isDue(task({ schedule: "manual", lastRunAt: undefined }), 10 * DAY)).toBe(false);
  });
  test("disabled tasks are never due", () => {
    expect(isDue(task({ enabled: false }), 10 * DAY)).toBe(false);
  });
  test("a never-run enabled task is due", () => {
    expect(isDue(task({ lastRunAt: undefined }), 0)).toBe(true);
  });
  test("daily: due after 24h, not before", () => {
    expect(isDue(task({ schedule: "daily", lastRunAt: 0 }), DAY - 1)).toBe(false);
    expect(isDue(task({ schedule: "daily", lastRunAt: 0 }), DAY)).toBe(true);
  });
  test("weekly: due after 7d", () => {
    expect(isDue(task({ schedule: "weekly", lastRunAt: 0 }), 6 * DAY)).toBe(false);
    expect(isDue(task({ schedule: "weekly", lastRunAt: 0 }), 7 * DAY)).toBe(true);
  });
});
