/**
 * Colours for things that leave the app (exported figures). Exports are
 * printed on white, so they always use the LIGHT theme's tokens, read from
 * the app's own stylesheet so there is one source of truth, even while the
 * user is in dark mode.
 */

const VAR_REF = /var\((--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g;
const MAX_DEPTH = 5;
/** Default shape when a figure's size is unknown (4:3). */
const DEFAULT_ASPECT = 3 / 4;

/**
 * Replace every var(--x) in markup with its value from `vars` (nested refs
 * too). Quotes are escaped so values like font stacks stay valid inside a
 * double-quoted attribute.
 */
export function resolveCssVars(text: string, vars: ReadonlyMap<string, string>, depth = 0): string {
  const out = text.replace(VAR_REF, (_m, name: string, fallback?: string) => {
    const value = vars.get(name) ?? fallback?.trim();
    return (value ?? "currentColor").replace(/"/g, "&quot;");
  });
  return depth < MAX_DEPTH && out.includes("var(--") ? resolveCssVars(out, vars, depth + 1) : out;
}

const isRootSelector = (selector: string) =>
  selector.split(",").every((s) => [":root", ":host", "html"].includes(s.trim()));

function collect(rules: CSSRuleList, into: Map<string, string>): void {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      // Only the base (light) theme: skip :root[data-theme="dark"] and the like.
      if (!isRootSelector(rule.selectorText)) continue;
      for (const prop of Array.from(rule.style)) {
        if (prop.startsWith("--")) into.set(prop, rule.style.getPropertyValue(prop).trim());
      }
    } else if ("cssRules" in rule && !(rule instanceof CSSMediaRule)) {
      // @layer / @supports blocks hold the Tailwind @theme output.
      collect((rule as CSSGroupingRule).cssRules, into);
    }
  }
}

/** The light theme's custom properties, from the loaded stylesheets. */
export function lightThemeVars(): Map<string, string> {
  const vars = new Map<string, string>();
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      collect(sheet.cssRules, vars);
    } catch {
      /* cross-origin stylesheet (e.g. a font CDN): no tokens in it */
    }
  }
  return vars;
}

/** Scale (w, h) to fit `max` wide, keeping its shape; never enlarge. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (!width || !height) return { width: max, height: Math.round(max * DEFAULT_ASPECT) };
  if (width <= max) return { width, height };
  return { width: max, height: Math.round((height * max) / width) };
}
