"use client";

import * as React from "react";
import { applyTheme, readThemePreference, watchSystemTheme } from "@/lib/theme";

/** Follows the system light/dark setting while the preference is "system". */
export function ThemeSync(): null {
  React.useEffect(
    () =>
      watchSystemTheme(() => {
        if (readThemePreference() === "system") applyTheme("system");
      }),
    [],
  );
  return null;
}
