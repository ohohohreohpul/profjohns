"use client";

import * as React from "react";
import { TextB as Bold, TextItalic as Italic, List, ListNumbers as ListOrdered, CaretDown as ChevronDown } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * Inline rich-text controls for the Draft node's single contentEditable body.
 * We use document.execCommand — deprecated but the simplest, universally
 * supported way to toggle formatting on a live selection. onMouseDown is
 * prevented on every control so the editor keeps its selection on click.
 */
function exec(command: string, value?: string) {
  document.execCommand(command, false, value);
}

const BLOCK_STYLES = [
  { tag: "<p>", label: "Paragraph" },
  { tag: "<h1>", label: "Heading" },
  { tag: "<h2>", label: "Subheading" },
] as const;

function preventBlur(e: React.MouseEvent) {
  e.preventDefault();
}

function StyleDropdown() {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Text style"
        title="Text style"
        onMouseDown={preventBlur}
        onClick={() => setOpen((o) => !o)}
        className="nodrag flex h-7 items-center gap-1 rounded-md px-2 text-[12.5px] font-medium text-grey-600 transition-colors hover:bg-grey-100 hover:text-ink"
      >
        Paragraph
        <ChevronDown className="size-3.5 text-grey-400" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 min-w-[150px] rounded-lg border border-grey-200 bg-paper p-1 shadow-[0_12px_30px_-12px_rgba(21,23,28,0.32)]">
          {BLOCK_STYLES.map((s) => (
            <button
              key={s.tag}
              type="button"
              onMouseDown={preventBlur}
              onClick={() => {
                exec("formatBlock", s.tag);
                setOpen(false);
              }}
              className="nodrag flex w-full items-center rounded-md px-2 py-1.5 text-left text-[12.5px] font-medium text-grey-700 transition-colors hover:bg-grey-100 hover:text-ink"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface FormatButton {
  command: string;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}

const BUTTONS: readonly FormatButton[] = [
  { command: "bold", label: "Bold", hint: "Bold (⌘B)", icon: Bold },
  { command: "italic", label: "Italic", hint: "Italic (⌘I)", icon: Italic },
  { command: "insertUnorderedList", label: "Bulleted list", hint: "Bulleted list", icon: List },
  { command: "insertOrderedList", label: "Numbered list", hint: "Numbered list", icon: ListOrdered },
];

export function FormattingToolbar() {
  const buttonClass =
    "nodrag grid size-7 place-items-center rounded-md text-grey-500 transition-colors hover:bg-grey-100 hover:text-ink";
  return (
    <div className="flex items-center gap-0.5">
      <StyleDropdown />
      <span className="mx-0.5 h-5 w-px bg-grey-200" />
      {BUTTONS.map((b, i) => {
        const Icon = b.icon;
        const divider = i === 2;
        return (
          <React.Fragment key={b.command}>
            {divider && <span className="mx-0.5 h-5 w-px bg-grey-200" />}
            <button
              type="button"
              aria-label={b.label}
              title={b.hint}
              onMouseDown={preventBlur}
              onClick={() => exec(b.command)}
              className={cn(buttonClass)}
            >
              <Icon className="size-[15px]" />
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
