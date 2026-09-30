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
  // hydration gate, this wiped EVERY stored board. (Wait on a concrete DOM
  // signal, not networkidle — external font <link>s keep the network busy.)
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main, body").first()).toBeVisible();
  await page.waitForTimeout(1500);

  const boardKey = await page.evaluate(() =>
    Object.keys(localStorage).find((k) => k.includes("cv-e2e-keep")),
  );
  expect(boardKey, "board key must survive a home-page visit").toBeTruthy();

  // The board itself still opens with all 3 nodes.
  await gotoCanvas(page, "cv-e2e-keep");
  await expect(page.locator(NODE)).toHaveCount(3);
});

/** Deterministic search results so the test never depends on OpenAlex. */
const STUB_PAPERS = [
  {
    id: "stub-alpha-1",
    title: "Alpha-only paper that must never appear on another canvas",
    authors: "A. Tester",
    venue: "E2E Journal",
    year: 2024,
    abstract: "Fixture abstract.",
    url: "https://example.org/alpha-1",
  },
];

test("a new canvas created in-app never inherits the previous canvas's sources", async ({ page }) => {
  // Stub providers + AI: with AI unavailable the scout keeps every result,
  // which commits them to the store — the exact state that used to leak.
  await page.route("**/api/openalex**", (route) =>
    route.fulfill({ json: { success: true, data: STUB_PAPERS, error: null } }),
  );
  await page.route("**/api/ai**", (route) =>
    route.fulfill({ status: 502, json: { success: false, data: null, error: "AI off in e2e" } }),
  );

  // Create canvas A from the Canvases surface — client-side navigation,
  // exactly as a user does it (no hard reload between boards).
  await page.goto("/canvases?project=p-e2e-leak");
  await page.getByRole("button", { name: "New canvas" }).click();
  await expect(page.locator(NODE)).toHaveCount(2, { timeout: 20_000 });

  // Run a search in canvas A's Sources node until its results are kept.
  const topic = page.getByPlaceholder("What are you researching?");
  await topic.fill("alpha leak probe");
  await topic.press("Enter");
  await page.getByRole("button", { name: /Search \d+ angle/ }).click();
  await expect(page.getByText(STUB_PAPERS[0].title)).toBeVisible({ timeout: 20_000 });

  // Back to the Canvases list (SPA), then create canvas B.
  await page.goBack();
  await page.getByRole("button", { name: "New canvas" }).click();
  await expect(page.locator(NODE)).toHaveCount(2, { timeout: 20_000 });

  // Canvas B must be a clean seed: empty topic, no results from A.
  await expect(page.getByPlaceholder("What are you researching?")).toHaveValue("");
  await expect(page.getByText(STUB_PAPERS[0].title)).toHaveCount(0);
  await expect(page.getByText(/\d+ kept/)).toHaveCount(0);
});
