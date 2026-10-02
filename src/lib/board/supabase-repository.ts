/**
 * Supabase BoardRepository — the source of truth for signed-in users.
 * Row-level security (supabase/boards.sql) enforces ownership server-side;
 * this layer validates payloads, maps rows, and turns failures into
 * BoardRepositoryError with messages safe to show.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CARD_KINDS,
  DEFAULT_WALLS,
  LINK_RELATIONS,
  WALL_KINDS,
  parseCardData,
  type Card,
  type CardKind,
  type CardLink,
  type LinkRelation,
  type Wall,
} from "./schema";
import { positionsFor } from "./position";
import { BoardRepositoryError, type BoardRepository, type CardPatch, type NewCard } from "./repository";

interface WallRow {
  id: string;
  board_id: string;
  kind: string;
  title: string;
  position: number;
  collapsed: boolean;
}

interface CardRow {
  id: string;
  board_id: string;
  wall_id: string | null;
  kind: string;
  position: number;
  data: unknown;
  updated_at: string;
}

interface LinkRow {
  id: string;
  board_id: string;
  from_card: string;
  to_card: string;
  relation: string;
}

const WALL_COLUMNS = "id, board_id, kind, title, position, collapsed";
const CARD_COLUMNS = "id, board_id, wall_id, kind, position, data, updated_at";
const LINK_COLUMNS = "id, board_id, from_card, to_card, relation";
/** Postgres unique_violation. */
const UNIQUE_VIOLATION = "23505";

function toWall(r: WallRow): Wall | null {
  if (!(WALL_KINDS as readonly string[]).includes(r.kind)) return null;
  return { id: r.id, boardId: r.board_id, kind: r.kind as Wall["kind"], title: r.title, position: r.position, collapsed: r.collapsed };
}

function toCard(r: CardRow): Card | null {
  if (!(CARD_KINDS as readonly string[]).includes(r.kind)) return null;
  const kind = r.kind as CardKind;
  try {
    return { id: r.id, boardId: r.board_id, wallId: r.wall_id, kind, position: r.position, data: parseCardData(kind, r.data), updatedAt: r.updated_at };
  } catch {
    return null;
  }
}

function toLink(r: LinkRow): CardLink | null {
  if (!(LINK_RELATIONS as readonly string[]).includes(r.relation)) return null;
  return { id: r.id, boardId: r.board_id, fromCard: r.from_card, toCard: r.to_card, relation: r.relation as LinkRelation };
}

export class SupabaseBoardRepository implements BoardRepository {
  constructor(private readonly sb: SupabaseClient) {}

  async load(boardId: string) {
    const [walls, cards, links] = await Promise.all([
      this.sb.from("walls").select(WALL_COLUMNS).eq("board_id", boardId).order("position"),
      this.sb.from("cards").select(CARD_COLUMNS).eq("board_id", boardId).order("position"),
      this.sb.from("card_links").select(LINK_COLUMNS).eq("board_id", boardId),
    ]);
    const failed = walls.error ?? cards.error ?? links.error;
    if (failed) throw new BoardRepositoryError("Couldn't load this board. Check your connection and try again.", failed);

    const w = (walls.data as WallRow[]).map(toWall);
    const c = (cards.data as CardRow[]).map(toCard);
    const l = (links.data as LinkRow[]).map(toLink);
    const keep = <T>(xs: (T | null)[]) => xs.filter((x): x is T => x !== null);
    return {
      walls: keep(w),
      cards: keep(c),
      links: keep(l),
      skipped: w.length + c.length + l.length - keep(w).length - keep(c).length - keep(l).length,
    };
  }

  async ensureBoard(board: { boardId: string; projectId: string; boardName: string; projectName: string }): Promise<void> {
    const userId = await this.userId();
    // ignoreDuplicates: insert when missing, leave existing rows untouched.
    const project = await this.sb
      .from("projects")
      .upsert({ id: board.projectId, user_id: userId, name: board.projectName }, { onConflict: "id", ignoreDuplicates: true });
    if (project.error) throw new BoardRepositoryError("Couldn't set up this project.", project.error);
    const canvas = await this.sb
      .from("canvases")
      .upsert(
        { id: board.boardId, project_id: board.projectId, user_id: userId, name: board.boardName },
        { onConflict: "id", ignoreDuplicates: true },
      );
    if (canvas.error) throw new BoardRepositoryError("Couldn't set up this board.", canvas.error);
  }

  async ensureDefaultWalls(boardId: string, projectId: string | null): Promise<readonly Wall[]> {
    const existing = await this.sb.from("walls").select(WALL_COLUMNS).eq("board_id", boardId).order("position");
    if (existing.error) throw new BoardRepositoryError("Couldn't load this board's columns.", existing.error);
    if (existing.data.length > 0) return (existing.data as WallRow[]).map(toWall).filter((x): x is Wall => x !== null);

    const userId = await this.userId();
    const positions = positionsFor(DEFAULT_WALLS.length);
    const rows = DEFAULT_WALLS.map((w, i) => ({
      board_id: boardId, project_id: projectId, user_id: userId, kind: w.kind, title: w.title, position: positions[i],
    }));
    const inserted = await this.sb.from("walls").insert(rows).select(WALL_COLUMNS);
    if (inserted.error?.code === UNIQUE_VIOLATION) {
      // Another load created them first (walls_board_kind_unique): use theirs.
      const winner = await this.sb.from("walls").select(WALL_COLUMNS).eq("board_id", boardId).order("position");
      if (winner.error) throw new BoardRepositoryError("Couldn't load this board's columns.", winner.error);
      return (winner.data as WallRow[]).map(toWall).filter((x): x is Wall => x !== null);
    }
    if (inserted.error) throw new BoardRepositoryError("Couldn't set up this board's columns.", inserted.error);
    return (inserted.data as WallRow[]).map(toWall).filter((x): x is Wall => x !== null).sort((a, b) => a.position - b.position);
  }

  async addCard<K extends CardKind>(input: NewCard<K>): Promise<Card<K>> {
    const data = parseCardData(input.kind, input.data);
    const res = await this.sb
      .from("cards")
      .insert({
        board_id: input.boardId, project_id: input.projectId, wall_id: input.wallId,
        user_id: await this.userId(), kind: input.kind, position: input.position, data,
      })
      .select(CARD_COLUMNS)
      .single();
    if (res.error) throw new BoardRepositoryError("Couldn't add that card.", res.error);
    return toCard(res.data as CardRow) as Card<K>;
  }

  async addCards(inputs: readonly NewCard[]): Promise<readonly Card[]> {
    if (inputs.length === 0) return [];
    const userId = await this.userId();
    const rows = inputs.map((input) => ({
      board_id: input.boardId, project_id: input.projectId, wall_id: input.wallId,
      user_id: userId, kind: input.kind, position: input.position, data: parseCardData(input.kind, input.data),
    }));
    const res = await this.sb.from("cards").insert(rows).select(CARD_COLUMNS);
    if (res.error) throw new BoardRepositoryError("Couldn't move your existing board over.", res.error);
    return (res.data as CardRow[]).map(toCard).filter((c): c is Card => c !== null);
  }

  async claimReturn(boardId: string): Promise<boolean> {
    // Conditional update: only the caller that sees version 2 moves the board back.
    const res = await this.sb.from("canvases").update({ board_version: 3 }).eq("id", boardId).eq("board_version", 2).select("id");
    if (res.error) throw new BoardRepositoryError("Couldn't prepare this canvas.", res.error);
    return res.data.length === 1;
  }

  async releaseReturn(boardId: string): Promise<void> {
    const res = await this.sb.from("canvases").update({ board_version: 2 }).eq("id", boardId);
    if (res.error) throw new BoardRepositoryError("Couldn't reset this canvas's import.", res.error);
  }

  async releaseConversion(boardId: string): Promise<void> {
    const res = await this.sb.from("canvases").update({ board_version: 1 }).eq("id", boardId);
    if (res.error) throw new BoardRepositoryError("Couldn't reset this board's conversion.", res.error);
  }

  async claimConversion(boardId: string): Promise<boolean> {
    // Conditional update: only the caller that sees version 1 flips it.
    const res = await this.sb
      .from("canvases")
      .update({ board_version: 2 })
      .eq("id", boardId)
      .eq("board_version", 1)
      .select("id");
    if (res.error) throw new BoardRepositoryError("Couldn't prepare this board.", res.error);
    return res.data.length === 1;
  }

  async updateCard(id: string, patch: CardPatch): Promise<Card> {
    const update: Record<string, unknown> = {};
    if (patch.wallId !== undefined) update.wall_id = patch.wallId;
    if (patch.position !== undefined) update.position = patch.position;
    if (patch.data !== undefined) {
      const current = await this.sb.from("cards").select("kind").eq("id", id).single();
      if (current.error) throw new BoardRepositoryError("That card no longer exists.", current.error);
      update.data = parseCardData(current.data.kind as CardKind, patch.data);
    }
    const res = await this.sb.from("cards").update(update).eq("id", id).select(CARD_COLUMNS).single();
    if (res.error) throw new BoardRepositoryError("Couldn't save that change.", res.error);
    const card = toCard(res.data as CardRow);
    if (!card) throw new BoardRepositoryError("That card's saved data is invalid.");
    return card;
  }

  async deleteCard(id: string): Promise<void> {
    const res = await this.sb.from("cards").delete().eq("id", id);
    if (res.error) throw new BoardRepositoryError("Couldn't delete that card.", res.error);
  }

  async addLink(boardId: string, fromCard: string, toCard: string, relation: LinkRelation): Promise<CardLink> {
    const res = await this.sb
      .from("card_links")
      .insert({ board_id: boardId, user_id: await this.userId(), from_card: fromCard, to_card: toCard, relation })
      .select(LINK_COLUMNS)
      .single();
    if (res.error) throw new BoardRepositoryError("Couldn't link those cards.", res.error);
    return toLink(res.data as LinkRow) as CardLink;
  }

  async deleteLink(id: string): Promise<void> {
    const res = await this.sb.from("card_links").delete().eq("id", id);
    if (res.error) throw new BoardRepositoryError("Couldn't remove that link.", res.error);
  }

  /** Session read is local (no network); RLS re-checks it server-side. */
  private async userId(): Promise<string> {
    const { data } = await this.sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new BoardRepositoryError("Sign in to save your board.");
    return id;
  }
}
