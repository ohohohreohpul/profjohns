import { test, expect } from "@playwright/test";

/**
 * Regression pair that kept flip-flopping:
 * - clicking a node's body must SELECT it (broke when the body was `nodrag`)
 * - dragging the body / empty card space must NOT move the node; only the
 *   header handle drags (broke whenever selection was fixed the wrong way)
 */

const NODE = ".react-flow__node";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("profjohns-preloader-shown", "1");
    } catch {
      /* noop */
    }
  });
  await page.goto("/canvas?project=p-e2e&canvas=cv-e2e-nodes");
  await expect(page.locator(NODE).first()).toBeVisible({ timeout: 20_000 });
});

/** A point inside the card body that is NOT a nodrag control (input/buttons). */
async function bodyPoint(page: import("@playwright/test").Page) {
  const card = page.locator(`${NODE} .node-surface`).first();
  const box = (await card.boundingBox())!;
  // Bottom strip of the card: the idle hint text, plain content.
  return { x: box.x + box.width / 2, y: box.y + box.height - 14 };
}

test("clicking the card body selects the node", async ({ page }) => {
  const p = await bodyPoint(page);
  await page.mouse.click(p.x, p.y);
  await expect(page.locator(".node-surface.is-selected").first()).toBeVisible();
});

test("dragging from the card body does not move the node", async ({ page }) => {
  const node = page.locator(NODE).first();
  const before = (await node.boundingBox())!;

  const p = await bodyPoint(page);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 160, p.y + 120, { steps: 8 });
  await page.mouse.up();

  const after = (await node.boundingBox())!;
  expect(Math.abs(after.x - before.x)).toBeLessThan(2);
  expect(Math.abs(after.y - before.y)).toBeLessThan(2);
});

test("dragging from the header handle moves the node", async ({ page }) => {
  const node = page.locator(NODE).first();
  const before = (await node.boundingBox())!;

  const handle = page.locator(`${NODE} .node-drag-handle`).first();
  const hb = (await handle.boundingBox())!;
  const hx = hb.x + hb.width / 2;
  const hy = hb.y + hb.height / 2;

  await page.mouse.move(hx, hy);
  await page.mouse.down();
  await page.mouse.move(hx + 160, hy + 120, { steps: 8 });
  await page.mouse.up();

  const after = (await node.boundingBox())!;
  expect(Math.abs(after.x - before.x)).toBeGreaterThan(60);
  expect(Math.abs(after.y - before.y)).toBeGreaterThan(40);
});
