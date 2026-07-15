"use client";

import * as React from "react";
import { PencilSimple } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export function InlineEdit({
  value,
  onCommit,
  placeholder = "Untitled",
  className,
  inputClassName,
  displayClassName,
  iconSize = 14,
  align = "left",
}: {
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  displayClassName?: string;
  iconSize?: number;
  align?: "left" | "center";
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) {
      setDraft(value);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep draft in sync when value changes externally (e.g. direction sync).
  React.useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onCommit(trimmed);
    } else {
      setDraft(value);
    }
    setEditing(false);
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          "min-w-0 flex-1 rounded-md border border-grey-300 bg-paper px-1.5 py-0.5 text-sm font-semibold tracking-tight text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10",
          align === "center" && "text-center",
          inputClassName,
        )}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={cn(
        "group/edit flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-semibold tracking-tight text-ink transition-colors hover:bg-grey-100",
        align === "center" && "justify-center",
        className,
        displayClassName,
      )}
    >
      <span className="truncate">{value || placeholder}</span>
      <PencilSimple
        className="size-3 shrink-0 text-grey-500 opacity-0 transition-opacity group-hover/edit:opacity-100 group/edit:text-grey-500"
        style={{ width: iconSize, height: iconSize }}
      />
    </button>
  );
}
