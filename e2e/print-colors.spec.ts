import { test, expect } from "@playwright/test";
import { resolveCssVars, fitWithin } from "../src/lib/print-colors";

test("resolveCssVars swaps var() for the given values, following nested vars", () => {
  const vars = new Map([
    ["--color-viz-1", "#2563eb"],
    ["--color-paper", "#ffffff"],
    ["--background", "var(--color-paper)"],
  ]);
  const svg = '<rect fill="var(--color-viz-1)"/><text fill="var(--background)"/><line stroke="var(--unknown, #ccc)"/>';
  expect(resolveCssVars(svg, vars)).toBe('<rect fill="#2563eb"/><text fill="#ffffff"/><line stroke="#ccc"/>');
});

test("an unknown var with no fallback becomes a visible neutral, not transparent", () => {
  expect(resolveCssVars('<rect fill="var(--nope)"/>', new Map())).toBe('<rect fill="currentColor"/>');
});

test("fitWithin keeps aspect ratio and never upscales", () => {
  expect(fitWithin(2000, 1000, 576)).toEqual({ width: 576, height: 288 });
  expect(fitWithin(300, 600, 576)).toEqual({ width: 300, height: 600 });
  expect(fitWithin(0, 0, 576)).toEqual({ width: 576, height: 432 });
});

test("values with quotes stay valid inside markup attributes (font stacks)", () => {
  const vars = new Map([["--font-sans", '"Inter", ui-sans-serif, sans-serif']]);
  expect(resolveCssVars('<svg font-family="var(--font-sans)">', vars)).toBe('<svg font-family="&quot;Inter&quot;, ui-sans-serif, sans-serif">');
});
