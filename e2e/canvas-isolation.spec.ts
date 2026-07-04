import { test, expect, type Page } from "@playwright/test";

/**
 * Regression: "every canvas opens the same board / a new canvas falls back to
 * an old one." Boards must be isolated per canvas id, across both SPA
 * navigation and hard reloads, and visiting the home page must never wipe
 * stored boards (the prune-before-hydration bug).
 */

const NODE = ".react-flow__node";

async function gotoCanvas(page: Page, canvasId: string): Promise<void> {
  await page.goto(`/canvas?project=p-e2e&canvas=${canvasId}`);
  await expect(page.locator(NODE).first()).toBeVisible({ timeout: 20_000 });
}

test.beforeEach(async ({ page }) => {
  // Skip the cinematic preloader; start from clean storage.
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("profjohns-preloader-shown", "1");
    } catch {
      /* storage unavailable in this context — preloader will just play */
    }
  });
});

test("two canvases keep independent boards across navigation", async ({ page }) => {
  // Canvas alpha: seed (2 nodes) + one added Text node = 3.
  await gotoCanvas(page, "cv-e2e-alpha");
  await expect(page.locator(NODE)).toHaveCount(2);
  await page.getByRole("button", { name: "Add Text node" }).click();
  await expect(page.locator(NODE)).toHaveCount(3);

  // Canvas beta must open with ONLY its own fresh seed.
  await gotoCanvas(page, "cv-e2e-beta");
  await expect(page.locator(NODE)).toHaveCount(2);

  // And alpha must still have its 3 nodes — not beta's board, not a merge.
  await gotoCanvas(page, "cv-e2e-alpha");
  await expect(page.locator(NODE)).toHaveCount(3);

  // Beta unchanged after alpha was re-opened.
  await gotoCanvas(page, "cv-e2e-beta");
  await expect(page.locator(NODE)).toHaveCount(2);
});

test("boards survive a hard reload and a cold home-page visit", async ({ page }) => {
  await gotoCanvas(page, "cv-e2e-keep");
  await page.getByRole("button", { name: "Add Text node" }).click();
  await expect(page.locator(NODE)).toHaveCount(3);

  // Cold-load the home page (Discover) — pruneOrphans runs there. Before the
  // hydration gate, this wiped EVERY stored board.
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const boardKey = await page.evaluate(() =>
    Object.keys(localStorage).find((k) => k.includes("cv-e2e-keep")),
  );
  expect(boardKey, "board key must survive a home-page visit").toBeTruthy();

  // The board itself still opens with all 3 nodes.
  await gotoCanvas(page, "cv-e2e-keep");
  await expect(page.locator(NODE)).toHaveCount(3);
});
