"use client";

import * as React from "react";
import type { Card, Wall } from "@/lib/board/schema";
import { WALL_META } from "./wall-meta";

interface WallColumnProps {
  readonly wall: Wall;
  readonly cards: readonly Card[];
}

/** One titled column of the board. Cards render in Phase 2. */
export function WallColumn({ wall, cards }: WallColumnProps) {
  const meta = WALL_META[wall.kind];
  const Icon = meta.icon;
  const headingId = `wall-${wall.id}`;

  return (
    <section
      aria-labelledby={headingId}
      className="flex max-h-full w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-grey-200 bg-paper shadow-flat"
    >
      <div aria-hidden className="h-0.5 shrink-0" style={{ background: meta.accent }} />
      <header className="flex items-center gap-2 px-3.5 pb-2 pt-3">
        <Icon className="size-4 shrink-0" style={{ color: meta.accent }} weight="bold" />
        <h2 id={headingId} className="font-display min-w-0 flex-1 truncate text-sm font-semibold text-ink">
          {wall.title}
        </h2>
        <span className="rounded-full bg-grey-100 px-1.5 py-0.5 text-xs tabular-nums text-grey-600">
          {cards.length}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {cards.length === 0 ? (
          <div className="rounded-lg border border-dashed border-grey-300 px-3 py-4">
            <p className="text-sm font-medium text-ink">{meta.empty.what}</p>
            <p className="mt-1 text-xs leading-relaxed text-grey-600">{meta.empty.start}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {cards.map((c) => (
              <li key={c.id} className="rounded-lg border border-grey-200 bg-paper px-3 py-2 text-sm text-ink">
                {c.kind}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
