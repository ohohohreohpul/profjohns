/**
 * Rasterize the kit's SVG sections to PNG (for Figma upload, docs, decks).
 * Run from the repo root: node design/website-kit/render-png.mjs [outDir]
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KIT = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? path.join(KIT, "png");
fs.mkdirSync(OUT, { recursive: true });

const names = fs.readdirSync(KIT).filter((f) => f.endsWith(".svg")).sort();
const browser = await chromium.launch();
const page = await browser.newPage();

for (const f of names) {
  await page.goto("file://" + path.join(KIT, f));
  await page.locator("svg").screenshot({ path: path.join(OUT, f.replace(".svg", ".png")) });
}
await browser.close();
console.log(`rendered ${names.length} PNGs to ${OUT}`);
