import { test, expect } from "@playwright/test";
import { createKeyedQueue } from "../src/lib/board/keyed-queue";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Regression (prod, chart card): changing a card's type then its title sent
 * two saves at once; the slower first save landed last and erased the title.
 * Saves to one card must apply in the order they were made.
 */
test("saves to the same key run in order, even when the first is slower", async () => {
  const run = createKeyedQueue();
  const applied: string[] = [];
  const first = run("card-1", async () => {
    await wait(60);
    applied.push("type");
  });
  const second = run("card-1", async () => {
    await wait(5);
    applied.push("title");
  });
  await Promise.all([first, second]);
  expect(applied).toEqual(["type", "title"]);
});

test("different keys don't wait for each other", async () => {
  const run = createKeyedQueue();
  const applied: string[] = [];
  await Promise.all([
    run("a", async () => {
      await wait(60);
      applied.push("a");
    }),
    run("b", async () => {
      await wait(5);
      applied.push("b");
    }),
  ]);
  expect(applied).toEqual(["b", "a"]);
});

test("a failed save rejects its own caller but doesn't block the next one", async () => {
  const run = createKeyedQueue();
  const failed = run("k", async () => {
    throw new Error("network");
  });
  await expect(failed).rejects.toThrow("network");
  await expect(run("k", async () => "ok")).resolves.toBe("ok");
});
