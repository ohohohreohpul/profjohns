import { expect, test } from "@playwright/test";

/**
 * Accessibility tests — verify keyboard navigation, focus states, and
 * responsive layout across primary breakpoints.
 *
 * These tests run in local mode (no auth required) against the dev server.
 */

const BASE = "http://localhost:3211";

test.describe("Keyboard navigation", () => {
  test("skip navigation link is present and focusable", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    // Tab to the first focusable element
    await page.keyboard.press("Tab");
    // The skip link should be visible after focus
    const skipLink = page.getByText("Skip to main content");
    await expect(skipLink).toBeVisible();
  });

  test("login form is keyboard navigable", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    // Tab through form fields
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    // Should reach the email field
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeFocused();
  });

  test("Escape closes mobile sidebar drawer", async ({ browser }) => {
    // Mobile viewport
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/spaces`);

    // Open mobile sidebar
    const menuButton = page.getByLabel("Open menu");
    if (await menuButton.isVisible()) {
      await menuButton.click();
      // Verify drawer is open
      const drawer = page.getByRole("dialog", { name: "Mobile sidebar" });
      await expect(drawer).toBeVisible();

      // Press Escape to close
      await page.keyboard.press("Escape");
      await expect(drawer).not.toBeVisible();
    }
    await ctx.close();
  });
});

test.describe("Responsive layout", () => {
  const viewports = [
    { width: 280, height: 568, name: "small phone" },
    { width: 320, height: 568, name: "phone" },
    { width: 390, height: 844, name: "iPhone" },
    { width: 414, height: 896, name: "iPhone Max" },
    { width: 768, height: 1024, name: "iPad" },
    { width: 1440, height: 900, name: "desktop" },
  ];

  for (const vp of viewports) {
    test(`no horizontal overflow at ${vp.width}px (${vp.name})`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/login`);
      await page.waitForLoadState("networkidle");

      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth - document.documentElement.clientWidth;
      });
      expect(overflow).toBeLessThanOrEqual(2); // Small tolerance for rounding
      await ctx.close();
    });
  }
});

test.describe("Form accessibility", () => {
  test("login form has visible labels", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.locator('label:has-text("Email")')).toBeVisible();
    await expect(page.locator('label:has-text("Password")')).toBeVisible();
  });

  test("login form inputs have autocomplete attributes", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute("autocomplete", "email");
    const pwInput = page.locator('input[type="password"]');
    await expect(pwInput).toHaveAttribute("autocomplete", "current-password");
  });

  test("signup form password has new-password autocomplete", async ({ page }) => {
    await page.goto(`${BASE}/signup`);
    const pwInput = page.locator('input[type="password"]');
    await expect(pwInput).toHaveAttribute("autocomplete", "new-password");
  });
});
