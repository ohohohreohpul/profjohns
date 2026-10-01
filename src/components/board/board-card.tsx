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

const KIND_ACCENT: Record<Card["kind"], string> = {
  paper: "var(--color-node-explorer)",
  insight: "var(--color-node-processor)",
  theme: "var(--color-node-assistant)",
  note: "var(--color-grey-500)",
  question: "var(--color-ink)",
  draft: "var(--color-node-writing)",
};

interface BoardCardProps {
  readonly card: Card;
  readonly walls: readonly Wall[];
  readonly actions: BoardActions;
  readonly onRead: (paper: PaperSource) => void;
  /** Papers on the board by paper id, so insights can open their source. */
  readonly papersById: ReadonlyMap<string, PaperSource>;
}

/** Renders any card kind inside the shared frame. */
export function BoardCard({ card, walls, actions, onRead, papersById }: BoardCardProps) {
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
      return (
        <CardFrame {...frame} label={INSIGHT_LABELS[data.type] ?? "Insight"}>
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
    default:
      return (
        <CardFrame {...frame} label={card.kind === "theme" ? "Theme" : "Draft"}>
          <p className="text-sm text-grey-700">
            {card.kind === "theme" ? (card.data as Card<"theme">["data"]).name : (card.data as Card<"draft">["data"]).title || "Untitled draft"}
          </p>
        </CardFrame>
      );
  }
}
