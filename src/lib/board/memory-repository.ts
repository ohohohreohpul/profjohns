/**
 * In-memory BoardRepository — tests and signed-out local development.
 * Same validation and invariants as the Supabase implementation.
 */
import { DEFAULT_WALLS, parseCardData, type Card, type CardKind, type CardLink, type LinkRelation, type Wall } from "./schema";
import { positionsFor } from "./position";
import { BoardRepositoryError, type BoardRepository, type CardPatch, type NewCard } from "./repository";

export class MemoryBoardRepository implements BoardRepository {
  private walls = new Map<string, Wall>();
  private cards = new Map<string, Card>();
  private links = new Map<string, CardLink>();

  async load(boardId: string) {
    const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;
    return {
      walls: [...this.walls.values()].filter((w) => w.boardId === boardId).sort(byPosition),
      cards: [...this.cards.values()].filter((c) => c.boardId === boardId).sort(byPosition),
      links: [...this.links.values()].filter((l) => l.boardId === boardId),
      skipped: 0,
    };
  }

  async ensureBoard(): Promise<void> {
    /* No foreign keys in memory. */
  }

  /** In-flight creations, so concurrent calls share one (no duplicate walls). */
  private ensuring = new Map<string, Promise<readonly Wall[]>>();

  ensureDefaultWalls(boardId: string, _projectId?: string | null): Promise<readonly Wall[]> {
    const inFlight = this.ensuring.get(boardId);
    if (inFlight) return inFlight;
    const p = this.createDefaultWalls(boardId).finally(() => this.ensuring.delete(boardId));
    this.ensuring.set(boardId, p);
    return p;
  }

  private async createDefaultWalls(boardId: string): Promise<readonly Wall[]> {
    const existing = (await this.load(boardId)).walls;
    if (existing.length > 0) return existing;
    const positions = positionsFor(DEFAULT_WALLS.length);
    const created = DEFAULT_WALLS.map((w, i): Wall => ({
      id: crypto.randomUUID(),
      boardId,
      kind: w.kind,
      title: w.title,
      position: positions[i],
      collapsed: false,
    }));
    for (const w of created) this.walls.set(w.id, w);
    return created;
  }

  async addCard<K extends CardKind>(input: NewCard<K>): Promise<Card<K>> {
    this.assertWallOnBoard(input.wallId, input.boardId);
    const card: Card<K> = {
      id: crypto.randomUUID(),
      boardId: input.boardId,
      wallId: input.wallId,
      kind: input.kind,
      position: input.position,
      data: parseCardData(input.kind, input.data),
      updatedAt: new Date().toISOString(),
    };
    this.cards.set(card.id, card as Card);
    return card;
  }

  private versions = new Map<string, number>();

  async addCards(inputs: readonly NewCard[]): Promise<readonly Card[]> {
    const added: Card[] = [];
    for (const input of inputs) added.push(await this.addCard(input));
    return added;
  }

  async claimReturn(boardId: string): Promise<boolean> {
    if ((this.versions.get(boardId) ?? 1) !== 2) return false;
    this.versions.set(boardId, 3);
    return true;
  }

  async releaseReturn(boardId: string): Promise<void> {
    this.versions.set(boardId, 2);
  }

  async releaseConversion(boardId: string): Promise<void> {
    this.versions.set(boardId, 1);
  }

  async claimConversion(boardId: string): Promise<boolean> {
    if ((this.versions.get(boardId) ?? 1) !== 1) return false;
    this.versions.set(boardId, 2);
    return true;
  }

  async updateCard(id: string, patch: CardPatch): Promise<Card> {
    const current = this.cards.get(id);
    if (!current) throw new BoardRepositoryError("That card no longer exists.");
    const wallId = patch.wallId === undefined ? current.wallId : patch.wallId;
    this.assertWallOnBoard(wallId, current.boardId);
    const next: Card = {
      ...current,
      wallId,
      position: patch.position ?? current.position,
      data: patch.data === undefined ? current.data : parseCardData(current.kind, patch.data),
      updatedAt: new Date().toISOString(),
    };
    this.cards.set(id, next);
    return next;
  }

  async deleteCard(id: string): Promise<void> {
    this.cards.delete(id);
    for (const [linkId, l] of this.links) {
      if (l.fromCard === id || l.toCard === id) this.links.delete(linkId);
    }
  }

  async addLink(boardId: string, fromCard: string, toCard: string, relation: LinkRelation): Promise<CardLink> {
    const a = this.cards.get(fromCard);
    const b = this.cards.get(toCard);
    if (!a || !b || a.boardId !== boardId || b.boardId !== boardId || fromCard === toCard) {
      throw new BoardRepositoryError("Links must join two different cards on the same board.");
    }
    const link: CardLink = { id: crypto.randomUUID(), boardId, fromCard, toCard, relation };
    this.links.set(link.id, link);
    return link;
  }

  async deleteLink(id: string): Promise<void> {
    this.links.delete(id);
  }

  private assertWallOnBoard(wallId: string | null, boardId: string): void {
    if (wallId === null) return;
    if (this.walls.get(wallId)?.boardId !== boardId) {
      throw new BoardRepositoryError("That column isn't on this board.");
    }
  }
}
