import { test, expect, type Page } from "@playwright/test";

/**
 * Card types on the canvas (feature review step 2): Insight, Figure, Theme,
 * Chart nodes, created from the Reader, paste, and the toolbar.
 */

const NODE = ".react-flow__node";
const PAPER = {
  id: "W2",
  title: "Customer acquisition via display advertising using multi-armed bandit experiments",
  authors: "Eric M. Schwartz, Bradlow, Fader",
  venue: "Marketing Science",
  year: 2017,
  abstract: "Bandit experiments reallocate traffic toward better ads during the test.",
  url: "https://example.org/bandits",
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("profjohns-preloader-shown", "1");
    } catch {
      /* preloader just plays */
    }
  });
  await page.route("**/api/ai**", (r) => r.fulfill({ status: 502, json: { success: false, data: null, error: "AI off in e2e" } }));
  await page.route("**/api/jev", (r) => r.fulfill({ json: { success: true, data: { type: "finding" }, error: null, configured: true } }));
  await page.route("**/api/readable**", (r) => r.fulfill({ status: 502, json: { success: false, data: null, error: "offline" } }));
  await page.goto(`/canvas?project=p-e2e-cards&canvas=cv-e2e-cards-${Date.now()}`);
  await expect(page.locator(NODE).first()).toBeVisible({ timeout: 20_000 });
});

const nodeOf = (page: Page, kind: string) => page.locator(`${NODE}.react-flow__node-${kind}`);

test("the toolbar offers Insight, Figure and Theme; Chart sits under More", async ({ page }) => {
  for (const label of ["Insight", "Figure", "Theme"]) {
    await expect(page.getByRole("button", { name: `Add ${label} node` })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Add Image node" })).toHaveCount(0);
  await page.getByRole("button", { name: "More nodes" }).click();
  await expect(page.getByRole("button", { name: "Chart", exact: true })).toBeVisible();
});

test("paste spreadsheet cells on the canvas -> Chart node; paste an image -> Figure node", async ({ page }) => {
  await page.locator(".react-flow__pane").click({ position: { x: 600, y: 500 } });
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData("text/plain", "Model\tTop-1\nViT-B\t81.8\nMLP-Mixer\t76.4");
    window.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
  });
  await expect(nodeOf(page, "chart").getByRole("img", { name: /^Bar chart of Top-1 by Model, 2 rows/ })).toBeVisible();

  await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 40;
    c.height = 30;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#0e9f6e";
    ctx.fillRect(0, 0, 40, 30);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], "shot.png", { type: "image/png" }));
    window.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
  });
  const figure = nodeOf(page, "figure");
  await expect(figure.locator("img")).toBeVisible({ timeout: 15_000 });
  await figure.getByRole("textbox", { name: "Figure caption" }).fill("Conversion by arm");
  await figure.getByRole("textbox", { name: "Figure caption" }).blur();
  await expect(figure.getByRole("textbox", { name: "Figure caption" })).toHaveValue("Conversion by arm");
});

test("Make insight in the Reader -> Insight node wired to its paper; drop it on a Theme -> the theme's evidence", async ({ page }) => {
  // Tall enough that the new nodes stay on screen for the drag below.
  await page.setViewportSize({ width: 1600, height: 1400 });
  // A paper dragged onto the canvas (what the Sources node does).
  await page.evaluate((paper) => {
    const pane = document.querySelector(".react-flow__pane")!;
    const dt = new DataTransfer();
    dt.setData("application/x-lattice-paper", JSON.stringify(paper));
    for (const type of ["dragover", "drop"]) pane.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, clientX: 300, clientY: 300 }));
  }, PAPER);
  const paperNode = nodeOf(page, "paper");
  await expect(paperNode).toBeVisible();

  await paperNode.getByRole("button", { name: "Read" }).click();
  // The Reader's copy (the Paper node shows the abstract too).
  const abstract = page.getByText(PAPER.abstract, { exact: true }).last();
  await expect(abstract).toBeVisible({ timeout: 15_000 });
  await abstract.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page.getByRole("button", { name: "Make insight", exact: true }).dispatchEvent("click");
  const insight = nodeOf(page, "insight");
  await expect(insight).toContainText(PAPER.abstract, { timeout: 15_000 });
  await expect(insight).toContainText("Eric M. Schwartz et al. (2017)");
  await page.getByRole("button", { name: "Close" }).first().click();

  // Wired from its paper.
  const paperId = await paperNode.getAttribute("data-id");
  const insightId = await insight.getAttribute("data-id");
  await expect(page.locator(`.react-flow__edge[data-id*="${paperId}"][data-id*="${insightId}"], .react-flow__edge[aria-label*="${paperId}"]`).first()).toBeAttached();

  // A theme; drag the insight onto it.
  await page.getByRole("button", { name: "Add Theme node" }).click();
  const theme = nodeOf(page, "theme");
  await theme.getByRole("textbox", { name: "Theme name" }).fill("Bandits learn faster");
  await theme.getByRole("textbox", { name: "Theme name" }).blur();
  await expect(theme).toContainText("Drop an insight on this theme");
  const t = (await theme.boundingBox())!;
  const handle = (await insight.locator(".node-drag-handle").boundingBox())!;
  await page.mouse.move(handle.x + 10, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(theme).toContainText("1 insight · 1 paper");
});

test("a chart on the canvas can be placed in the Draft as Figure 1", async ({ page }) => {
  await page.locator(".react-flow__pane").click({ position: { x: 600, y: 500 } });
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData("text/plain", "epoch\tloss\n1\t0.92\n2\t0.51\n3\t0.33");
    window.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
  });
  await expect(nodeOf(page, "chart").getByRole("img", { name: /^Line chart of loss by epoch/ })).toBeVisible();

  // Open the seeded Draft in the full editor.
  await nodeOf(page, "writing").locator(".node-drag-handle").click();
  await page.getByRole("button", { name: "Open Draft" }).click();
  const editor = page.locator(".ProseMirror").last();
  await expect(editor).toBeVisible({ timeout: 15_000 });
  await editor.click();
  // The full editor's toolbar (the selected Draft node's floating toolbar has one too).
  await page.getByRole("button", { name: "Figure", exact: true }).last().click();
  await page.getByRole("menuitem", { name: "Untitled chart" }).click();
  const fig = editor.locator("figure[data-figure-ref]");
  await expect(fig.getByRole("img", { name: /^Line chart of loss by epoch/ })).toBeVisible();
  await expect(fig.locator("figcaption")).toHaveText("Figure 1.");
});
