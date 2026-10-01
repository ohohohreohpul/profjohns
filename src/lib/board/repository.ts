/**
 * Board data access (docs/REBUILD.md §7). The board UI depends only on this
 * interface; the server (Supabase) is the source of truth, and the in-memory
 * implementation backs tests and signed-out local development.
 */
import type { BoardSnapshot, Card, CardDataFor, CardKind, CardLink, LinkRelation, Wall } from "./schema";

export interface NewCard<K extends CardKind = CardKind> {
  readonly boardId: string;
  readonly projectId: string | null;
  readonly wallId: string | null;
  readonly kind: K;
  readonly position: number;
  /** Unvalidated payload; the repository validates before writing. */
  readonly data: unknown;
}

export interface CardPatch {
  readonly wallId?: string | null;
  readonly position?: number;
  /** Full replacement payload (validated against the card's kind). */
  readonly data?: unknown;
}

export interface BoardRepository {
  /** Everything on a board. Rows that fail validation are skipped, counted. */
  load(boardId: string): Promise<BoardSnapshot & { readonly skipped: number }>;
  /**
   * Make sure the project and board rows exist (walls and cards reference
   * them). Never overwrites an existing row's name.
   */
  ensureBoard(board: { boardId: string; projectId: string; boardName: string; projectName: string }): Promise<void>;
  /** Create the default walls if the board has none; returns the walls. */
  ensureDefaultWalls(boardId: string, projectId: string | null): Promise<readonly Wall[]>;
  addCard<K extends CardKind>(input: NewCard<K>): Promise<Card<K>>;
  /** Insert many cards in one request (used by the one-time converter). */
  addCards(inputs: readonly NewCard[]): Promise<readonly Card[]>;
  /**
   * Claim the one-time v1 -> v2 conversion: flips board_version 1 -> 2 and
   * returns true only for the caller that flipped it.
   */
  claimConversion(boardId: string): Promise<boolean>;
  /** Undo a claim when the conversion itself failed, so it can retry. */
  releaseConversion(boardId: string): Promise<void>;
  updateCard(id: string, patch: CardPatch): Promise<Card>;
  deleteCard(id: string): Promise<void>;
  addLink(boardId: string, fromCard: string, toCard: string, relation: LinkRelation): Promise<CardLink>;
  deleteLink(id: string): Promise<void>;
}

/** Thrown for any repository failure, with a message safe to show users. */
export class BoardRepositoryError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "BoardRepositoryError";
  }
}

export type { CardDataFor };
