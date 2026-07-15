import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE = "http://localhost:3211";
const PAGES = ["/", "/login", "/signup", "/spaces", "/agents"];
const VIEWPORTS = [
  { width: 1440, height: 900, name: "desktop" },
  { width: 390, height: 844, name: "mobile" },
];

const violations = [];

for (const page of PAGES) {
  for (const vp of VIEWPORTS) {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: vp });
    const p = await ctx.newPage();
    try {
      await p.goto(`${BASE}${page}`, { waitUntil: "networkidle", timeout: 15000 });
      const results = await new AxeBuilder({ page: p })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      const serious = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical"
      );
      if (serious.length > 0) {
        for (const v of serious) {
          violations.push({
            page,
            viewport: vp.name,
            rule: v.id,
            impact: v.impact,
            description: v.description,
            nodes: v.nodes.length,
            targets: v.nodes.slice(0, 3).map((n) => n.target.join(", ")),
          });
        }
      }
      console.log(`${vp.name} ${page}: ${serious.length} serious/critical violations`);
    } catch (e) {
      console.log(`${vp.name} ${page}: SKIP (${e.message})`);
    }
    await browser.close();
  }
}

console.log("\n=== AUDIT SUMMARY ===");
if (violations.length === 0) {
  console.log("No serious or critical axe violations found.");
} else {
  console.log(`${violations.length} serious/critical violations:`);
  for (const v of violations) {
    console.log(`  [${v.impact}] ${v.rule} on ${v.page} (${v.viewport}) — ${v.nodes} nodes`);
    console.log(`    ${v.description}`);
    console.log(`    targets: ${v.targets.join(" | ")}`);
  }
}
process.exit(violations.length > 0 ? 1 : 0);
