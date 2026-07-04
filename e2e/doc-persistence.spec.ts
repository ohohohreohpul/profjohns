import { test, expect } from "@playwright/test";

/**
 * Regression: the full-page doc editor (/doc) loaded the board without
 * marking it as loaded, so the persistence gate silently dropped every edit.
 * Text typed in /doc must survive a reload.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("profjohns-preloader-shown", "1");
    } catch {
      /* noop */
    }
  });
});

test("text written in the full-page doc editor survives a reload", async ({ page }) => {
  // Seed the canvas first so the writing node (n2) and its doc exist.
  await page.goto("/canvas?project=p-e2e&canvas=cv-e2e-doc");
  await expect(page.locator(".react-flow__node").first()).toBeVisible({
    timeout: 20_000,
  });

  // Open the same doc full-page and type into it.
  await page.goto("/doc?project=p-e2e&canvas=cv-e2e-doc&node=n2");
  const editor = page.locator(".ProseMirror").first();
  await expect(editor).toBeVisible({ timeout: 20_000 });
  await editor.click();
  await page.keyboard.type("persistence check 1234");
  await expect(editor).toContainText("persistence check 1234");

  // Give the store's persist a beat, then reload cold.
  await page.waitForTimeout(600);
  await page.reload();

  const editorAfter = page.locator(".ProseMirror").first();
  await expect(editorAfter).toBeVisible({ timeout: 20_000 });
  await expect(editorAfter).toContainText("persistence check 1234");

  // And the same text is there when read through the canvas store on /canvas.
  await page.goto("/canvas?project=p-e2e&canvas=cv-e2e-doc");
  await expect(page.locator(".react-flow__node").first()).toBeVisible({
    timeout: 20_000,
  });
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem("lattice-canvas-v1::cv-e2e-doc");
    return raw ?? "";
  });
  expect(stored).toContain("persistence check 1234");
});
