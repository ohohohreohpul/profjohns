"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TextCardBodyProps {
  readonly value: string;
  readonly placeholder: string;
  readonly onSave: (text: string) => void;
  /** The research question reads larger, in the editorial serif. */
  readonly prominent?: boolean;
  readonly ariaLabel: string;
}

/** Editable text (Note / Question). Saves on blur, only when changed. */
export function TextCardBody({ value, placeholder, onSave, prominent, ariaLabel }: TextCardBodyProps) {
  const [draft, setDraft] = React.useState(value);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  React.useEffect(() => setDraft(value), [value]);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={draft}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft.trim() !== value.trim()) onSave(draft);
      }}
      className={cn(
        "block w-full resize-none overflow-hidden bg-transparent text-ink outline-none placeholder:text-grey-500",
        prominent ? "font-serif text-base font-semibold leading-snug" : "text-sm leading-relaxed",
      )}
    />
  );
}
