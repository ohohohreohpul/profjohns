"use client";

import * as React from "react";
import { Desktop, Moon, Sun } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { readThemePreference, setThemePreference, type ThemePreference } from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", icon: Desktop },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

/** Three-way theme control (System / Light / Dark). */
export function ThemeSwitch({ className }: { className?: string }) {
  const [pref, setPref] = React.useState<ThemePreference>("system");
  React.useEffect(() => setPref(readThemePreference()), []);

  return (
    <div role="radiogroup" aria-label="Theme" className={cn("grid grid-cols-3 gap-0.5 rounded-lg bg-grey-100 p-0.5", className)}>
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = pref === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              setThemePreference(value);
              setPref(value);
            }}
            className={cn(
              "flex items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium transition-colors",
              active ? "bg-paper text-ink shadow-sm" : "text-grey-600 hover:text-ink",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
