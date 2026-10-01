/**
 * Run the one-time v1 -> v2 conversion for a board, at most once ever
 * (claimed via board_version). The v1 board blob is only read, never changed.
 */
import { convertV1Board } from "./convert-v1";
import { positionsFor } from "./position";
import type { BoardRepository, NewCard } from "./repository";

export interface ConversionResult {
  /** Cards created from the old canvas board (0 when nothing to move). */
  readonly moved: number;
}

export async function convertBoardOnce(
  repo: BoardRepository,
  board: { boardId: string; projectId: string },
  readV1: () => Promise<unknown>,
): Promise<ConversionResult> {
  const before = await repo.load(board.boardId);
  if (!(await repo.claimConversion(board.boardId))) return { moved: 0 };
  // Already has v2 content (created on the new board): nothing to move.
  if (before.cards.length > 0) return { moved: 0 };

  try {
    const converted = convertV1Board(await readV1());
    if (converted.length === 0) return { moved: 0 };
    const wallId = new Map(before.walls.map((w) => [w.kind, w.id]));
    const perWall = new Map<string, number>();
    for (const c of converted) perWall.set(c.wall, (perWall.get(c.wall) ?? 0) + 1);
    const positions = new Map([...perWall].map(([wall, n]) => [wall, positionsFor(n)]));
    const cursor = new Map<string, number>();
    const inputs: NewCard[] = converted.map((c) => {
      const i = cursor.get(c.wall) ?? 0;
      cursor.set(c.wall, i + 1);
      return {
        boardId: board.boardId,
        projectId: board.projectId,
        wallId: wallId.get(c.wall) ?? null,
        kind: c.kind,
        position: positions.get(c.wall)?.[i] ?? i,
        data: c.data,
      };
    });
    const added = await repo.addCards(inputs);
    return { moved: added.length };
  } catch (err: unknown) {
    await repo.releaseConversion(board.boardId).catch(() => undefined);
    throw err;
  }
}
