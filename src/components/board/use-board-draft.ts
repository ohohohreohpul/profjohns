"use client";

import * as React from "react";
import { useCanvasStore } from "@/store/canvas-store";
import { emptyDocContent, type WritingDoc } from "@/lib/document";
import { DEFAULT_STYLE, type CitationStyle } from "@/lib/citation";
import { buildClaims } from "@/lib/board/claims";
import type { BoardSnapshot, Card } from "@/lib/board/schema";
import type { PaperSource } from "@/lib/mock";
import type { BoardActions } from "./use-board";

/** Save typing back to the Draft card after this pause. */
const DRAFT_SAVE_DEBOUNCE_MS = 1000;
/**
 * The canvas store caches a board in this browser only while its
 * boardCanvasId matches the active canvas. On the v2 board the server is the
 * only truth, so we mark the store with an id that never matches.
 */
const V2_BOARD_MARK = "__v2_board__";

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

/**
 * The board's Draft in the full editor. The editor is store-driven (shared
 * with the canvas), so the Draft card's document is mirrored into the store
 * while open, its papers and insight claims are published as the draft
 * context, and edits are saved back to the card.
 */
export function useBoardDraft(snapshot: BoardSnapshot | null, actions: BoardActions, question: string) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const pending = React.useRef<{ id: string; doc: WritingDoc } | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    useCanvasStore.setState({ boardCanvasId: V2_BOARD_MARK });
  }, []);

  const themeWall = snapshot?.walls.find((w) => w.kind === "themes");
  const themes = React.useMemo(
    () =>
      (snapshot?.cards ?? [])
        .filter((c): c is Card<"theme"> => c.kind === "theme" && c.wallId === themeWall?.id)
        .sort(byPosition),
    [snapshot, themeWall],
  );
  const insights = React.useMemo(
    () => (snapshot?.cards ?? []).filter((c): c is Card<"insight"> => c.kind === "insight"),
    [snapshot],
  );
  const claims = React.useMemo(() => buildClaims(insights, themes), [insights, themes]);
  // Write from kept papers (any wall) and every paper an insight cites.
  const sources = React.useMemo(() => {
    const paperCards = (snapshot?.cards ?? []).filter((c): c is Card<"paper"> => c.kind === "paper");
    const kept = paperCards.filter((c) => c.data.status === "kept").map((c) => c.data.paper);
    const seen = new Set(kept.map((p) => p.id));
    const papers: PaperSource[] = [...kept];
    for (const c of paperCards) {
      const paper = c.data.paper;
      if (seen.has(paper.id)) continue;
      if (insights.some((i) => i.data.source?.paperId === paper.id)) {
        papers.push(paper);
        seen.add(paper.id);
      }
    }
    return papers;
  }, [snapshot, insights]);
  const outline = React.useMemo(() => themes.map((t) => t.data.name).filter(Boolean), [themes]);

  const flush = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    pending.current = null;
    if (p) {
      const { title, content, style, outline: o } = p.doc;
      void actions.updateCardData(p.id, { title, content, style, outline: o });
    }
  }, [actions]);

  // While open: keep the draft context fresh as the board changes.
  React.useEffect(() => {
    if (!openId) return;
    useCanvasStore.getState().setBoardDraftContext({ nodeId: openId, sources, claims });
  }, [openId, sources, claims]);

  // While open: save editor changes back to the Draft card (debounced).
  React.useEffect(() => {
    if (!openId) return;
    return useCanvasStore.subscribe((s, prev) => {
      const doc = s.docs[openId];
      if (!doc || doc === prev.docs[openId]) return;
      pending.current = { id: openId, doc };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, DRAFT_SAVE_DEBOUNCE_MS);
    });
  }, [openId, flush]);

  const open = React.useCallback(
    (cardId: string) => {
      const card = snapshot?.cards.find((c) => c.id === cardId);
      if (!card || card.kind !== "draft") return;
      const data = (card as Card<"draft">).data;
      const doc: WritingDoc = {
        title: data.title,
        content: data.content as WritingDoc["content"],
        style: data.style as CitationStyle,
        outline: data.outline.length > 0 ? data.outline : outline,
      };
      useCanvasStore.setState((s) => ({ docs: { ...s.docs, [cardId]: doc } }));
      useCanvasStore.getState().setBoardDraftContext({ nodeId: cardId, sources, claims });
      setOpenId(cardId);
    },
    [snapshot, outline, sources, claims],
  );

  const close = React.useCallback(() => {
    flush();
    setOpenId(null);
    useCanvasStore.getState().setBoardDraftContext(null);
  }, [flush]);

  // Never lose the last keystrokes on unmount.
  React.useEffect(() => () => flush(), [flush]);

  const startDraft = React.useCallback(async () => {
    const wall = snapshot?.walls.find((w) => w.kind === "draft");
    if (!wall) return;
    const card = await actions.addCard(wall.id, "draft", {
      title: question,
      content: emptyDocContent(),
      style: DEFAULT_STYLE,
      outline,
    });
    if (card) setOpenId(null);
  }, [snapshot, actions, question, outline]);

  const insightsByTheme = React.useMemo(() => {
    const m = new Map<string, Card<"insight">[]>();
    for (const i of insights) {
      if (!i.data.themeId) continue;
      m.set(i.data.themeId, [...(m.get(i.data.themeId) ?? []), i]);
    }
    return m;
  }, [insights]);

  return { openId, open, close, startDraft, themes, insightsByTheme };
}
