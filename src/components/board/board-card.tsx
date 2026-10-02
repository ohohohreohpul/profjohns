"use client";

import * as React from "react";
import type { Card, Wall } from "@/lib/board/schema";
import type { PaperSource } from "@/lib/mock";
import { INSIGHT_LABELS } from "@/lib/insight";
import type { BoardActions } from "./use-board";
import { CardFrame } from "./cards/card-frame";
import { PaperCardBody } from "./cards/paper-card";
import { InsightCardBody } from "./cards/insight-card";
import { TextCardBody } from "./cards/text-card";
import { ThemeCardBody } from "./cards/theme-card";
import { DraftCardBody } from "./cards/draft-card";
import { FigureCardBody } from "./cards/figure-card";

const KIND_ACCENT: Record<Card["kind"], string> = {
  paper: "var(--color-node-explorer)",
  insight: "var(--color-node-processor)",
  theme: "var(--color-node-assistant)",
  note: "var(--color-grey-500)",
  question: "var(--color-ink)",
  draft: "var(--color-node-writing)",
  figure: "var(--color-node-media)",
  chart: "var(--color-node-reader)",
};

interface BoardCardProps {
  readonly card: Card;
  readonly walls: readonly Wall[];
  readonly actions: BoardActions;
  readonly onRead: (paper: PaperSource) => void;
  /** Papers on the board by paper id, so insights can open their source. */
  readonly papersById: ReadonlyMap<string, PaperSource>;
  readonly themes: readonly Card<"theme">[];
  readonly insightsByTheme: ReadonlyMap<string, readonly Card<"insight">[]>;
  /** All cards by id (to validate drops onto themes). */
  readonly cardsById: ReadonlyMap<string, Card>;
  readonly onOpenDraft: (cardId: string) => void;
}

/** Renders any card kind inside the shared frame. */
export function BoardCard({ card, walls, actions, onRead, papersById, themes, insightsByTheme, cardsById, onOpenDraft }: BoardCardProps) {
  const frame = {
    cardId: card.id,
    accent: KIND_ACCENT[card.kind],
    walls,
    currentWallId: card.wallId,
    onMove: (wallId: string) => void actions.moveCard(card.id, wallId),
    onDelete: () => void actions.deleteCard(card.id),
  };

  switch (card.kind) {
    case "paper": {
      const data = card.data as Card<"paper">["data"];
      return (
        <CardFrame {...frame} label="Paper" dimmed={data.status === "new"} deleteLabel={data.status === "new" ? "Dismiss" : "Delete"}>
          <PaperCardBody
            data={data}
            onRead={() => onRead(data.paper)}
            onKeep={() => void actions.updateCardData(card.id, { ...data, status: "kept" })}
          />
        </CardFrame>
      );
    }
    case "insight": {
      const data = card.data as Card<"insight">["data"];
      const paper = data.source ? papersById.get(data.source.paperId) : undefined;
      const theme = themes.find((t) => t.id === data.themeId);
      const setTheme = (themeId: string | undefined) => {
        const { themeId: _old, ...rest } = data;
        void actions.updateCardData(card.id, themeId ? { ...rest, themeId } : rest);
      };
      const menuItems = [
        ...themes
          .filter((t) => t.id !== data.themeId)
          .map((t) => ({ label: `Add to theme: ${t.data.name || "Untitled theme"}`, onSelect: () => setTheme(t.id) })),
        ...(theme ? [{ label: "Remove from theme", onSelect: () => setTheme(undefined) }] : []),
      ];
      return (
        <CardFrame
          {...frame}
          label={INSIGHT_LABELS[data.type] ?? "Insight"}
          tag={theme ? theme.data.name || "Untitled theme" : undefined}
          menuItems={menuItems}
        >
          <InsightCardBody data={data} onOpenSource={paper ? () => onRead(paper) : undefined} />
        </CardFrame>
      );
    }
    case "question": {
      const data = card.data as Card<"question">["data"];
      return (
        <CardFrame {...frame} label="Research question">
          <TextCardBody
            prominent
            ariaLabel="Research question"
            value={data.text}
            placeholder="What does your research ask?"
            onSave={(text) => void actions.updateCardData(card.id, { text })}
          />
        </CardFrame>
      );
    }
    case "note": {
      const data = card.data as Card<"note">["data"];
      return (
        <CardFrame {...frame} label="Note">
          <TextCardBody
            ariaLabel="Note"
            value={data.text}
            placeholder="Write a note…"
            onSave={(text) => void actions.updateCardData(card.id, { text })}
          />
        </CardFrame>
      );
    }
    case "theme": {
      const data = card.data as Card<"theme">["data"];
      return (
        <CardFrame {...frame} label="Theme">
          <ThemeCardBody
            data={data}
            insights={insightsByTheme.get(card.id) ?? []}
            onRename={(name) => void actions.updateCardData(card.id, { ...data, name })}
            onDropInsight={(droppedId) => {
              const dropped = cardsById.get(droppedId);
              if (dropped?.kind !== "insight") return;
              void actions.updateCardData(droppedId, { ...(dropped.data as Card<"insight">["data"]), themeId: card.id });
            }}
          />
        </CardFrame>
      );
    }
    case "figure": {
      const data = card.data as Card<"figure">["data"];
      const paper = data.source ? papersById.get(data.source.paperId) : undefined;
      return (
        <CardFrame {...frame} label="Figure">
          <FigureCardBody
            data={data}
            onCaption={(caption) => void actions.updateCardData(card.id, { ...data, caption })}
            onOpenSource={paper ? () => onRead(paper) : undefined}
          />
        </CardFrame>
      );
    }
    case "chart": {
      const data = card.data as Card<"chart">["data"];
      return (
        <CardFrame {...frame} label="Chart">
          <p className="text-sm font-medium text-ink">{data.title || "Untitled chart"}</p>
          <p className="mt-1 text-xs text-grey-600">{data.rows.length} rows</p>
        </CardFrame>
      );
    }
    case "draft": {
      const data = card.data as Card<"draft">["data"];
      return (
        <CardFrame {...frame} label="Draft">
          <DraftCardBody data={data} onOpen={() => onOpenDraft(card.id)} />
        </CardFrame>
      );
    }
  }
}
