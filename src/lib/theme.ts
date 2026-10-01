/**
 * Theme preference: light (default), dark, or follow the system.
 *
 * The resolved theme is applied as `data-theme` on <html> by an inline script
 * before first paint (no flash of the wrong theme), and kept in sync with the
 * system setting by ThemeSync. CSS reads `:root[data-theme="dark"]`.
 */

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "profjohns-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref !== "system") return pref;
  return typeof window !== "undefined" && window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function applyTheme(pref: ThemePreference): void {
  document.documentElement.dataset.theme = resolveTheme(pref);
}

export function setThemePreference(pref: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* storage unavailable: the choice still applies for this page view */
  }
  applyTheme(pref);
}

/** Subscribe to system theme changes; only matters while preference is "system". */
export function watchSystemTheme(onChange: () => void): () => void {
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * Runs inline in <head> before paint. Mirrors readThemePreference +
 * resolveTheme; kept dependency-free because it is serialized as a string.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(p!=="light"&&p!=="dark")p="system";var d=p==="dark"||(p==="system"&&window.matchMedia(${JSON.stringify(
  DARK_QUERY,
)}).matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;
